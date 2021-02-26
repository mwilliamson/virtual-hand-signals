import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import { Duration, Instant } from "@js-joda/core";
import * as pg from "pg";

import { applyUpdate, Meeting, ServerMessage, Updates } from "./meetings";

export interface Connection {
    close: () => Promise<void>;

    createMeeting: (meeting: Meeting) => Promise<boolean>;
    fetchMeetingByMeetingCode: (meetingCode: string) => Promise<Meeting | undefined>;
    updateMeetingByMeetingCode: (meetingCode: string, f: (meeting: Meeting) => Meeting) => Promise<Meeting | undefined>;

    fetchSessionBySessionId: (sessionId: string) => Promise<Session | undefined>;
    reapExpiredSessions: (args: {
        sessionExpiration: Duration,
        sendToMeetingClients: (meetingCode: string, message: ServerMessage) => void,
    }) => Promise<void>;
    updateSession: (args: {meetingCode: string, memberId: string, sessionId: string}) => Promise<void>;
}

interface Session {
    memberId: string;
    sessionId: string;
}

export async function connect(url: string): Promise<Connection> {
    const pool = new pg.Pool({
        connectionString: url,
        ssl: {
            rejectUnauthorized: false
        },
    });

    await pool.query(
        `
            CREATE TABLE IF NOT EXISTS meetings (
                meeting_code VARCHAR PRIMARY KEY,
                value JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                session_id VARCHAR PRIMARY KEY,
                meeting_code VARCHAR NOT NULL,
                member_id VARCHAR NOT NULL,
                last_alive TIMESTAMPTZ NOT NULL
            );
            CREATE INDEX IF NOT EXISTS index_name ON sessions (last_alive);
        `
    );

    const withTransaction = async <T>(f: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            try {
                const result = f(client);
                await client.query("COMMIT");
                return result;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        } finally {
            client.release();
        }
    };

    const acquireMeetingLock = async (client: pg.PoolClient, meetingCode: string) => {
        await client.query("SELECT pg_advisory_xact_lock($1)", [meetingCodeToLockId(meetingCode)]);
    };

    const withMeetingLock = async <T>(meetingCode: string, f: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
        return await withTransaction(async (client) => {
            await  acquireMeetingLock(client, meetingCode);
            return f(client);
        });
    };

    const fetchMeetingOrUndefined = async (client: pg.PoolClient, meetingCode: string): Promise<Meeting | undefined> => {
        const {rows} = await client.query(
            "SELECT value FROM meetings WHERE meeting_code = $1",
            [meetingCode],
        );
        return rows.length === 0 ? undefined : decodeMeeting(rows[0].value);
    };

    const updateMeetingByMeetingCodeNoLock = async (
        client: pg.PoolClient,
        meetingCode: string,
        f: (meeting: Meeting) => Meeting,
    ): Promise<Meeting | undefined> => {
        const meeting = await fetchMeetingOrUndefined(client, meetingCode);
        if (meeting === undefined) {
            return undefined;
        } else {
            const newMeeting = f(meeting);
            await client.query(
                "UPDATE meetings SET value = $2 WHERE meeting_code = $1",
                [meetingCode, Meeting.encode(newMeeting)],
            );
            return newMeeting;
        }
    };

    return {
        createMeeting: async (meeting: Meeting): Promise<boolean> => {
            return withMeetingLock(meeting.meetingCode, async (client) => {
                const {rowCount} = await client.query(
                    `
                        INSERT INTO meetings (meeting_code, value)
                        VALUES ($1, $2)
                        ON CONFLICT
                        DO NOTHING
                    `,
                    [meeting.meetingCode, Meeting.encode(meeting)],
                );
                return rowCount >= 1;
            });
        },

        fetchMeetingByMeetingCode: async (meetingCode: string) => {
            return withMeetingLock(meetingCode, async (client) => {
                return fetchMeetingOrUndefined(client, meetingCode);
            });
        },

        updateMeetingByMeetingCode: async (meetingCode: string, f: (meeting: Meeting) => Meeting) => {
            return withMeetingLock(meetingCode, async (client) => {
                return updateMeetingByMeetingCodeNoLock(client, meetingCode, f);
            });
        },

        // TODO: session fetch/update needs locking? (or other concurrency handling)

        fetchSessionBySessionId: async (sessionId: string) => {
            const {rows} = await pool.query(
                `SELECT member_id, session_id FROM sessions WHERE session_id = $1`,
                [sessionId],
            );
            return rows.length === 0 ? undefined : {
                memberId: rows[0].member_id,
                sessionId: rows[0].session_id,
            };
        },

        reapExpiredSessions: async ({sessionExpiration, sendToMeetingClients}) => {
            const minLastAlive = Instant.now().minus(sessionExpiration);

            interface SessionRow {
                meeting_code: string;
                member_id: string;
            }

            await withTransaction(async (client) => {
                const {rows} = await pool.query(
                    `
                        DELETE FROM sessions
                        WHERE last_alive < $1
                        RETURNING meeting_code, member_id
                    `,
                    [minLastAlive],
                );

                for (const row of rows) {
                    // TODO: should this logic be in here? Not really about database interaction
                    // Pull out transaction abstraction?
                    const {meeting_code: meetingCode, member_id: memberId} = row as SessionRow;
                    await acquireMeetingLock(client, meetingCode);
                    const update = Updates.leave({memberId});
                    await updateMeetingByMeetingCodeNoLock(
                        client,
                        meetingCode,
                        meeting => applyUpdate(meeting, update),
                    );
                    sendToMeetingClients(meetingCode, update);
                }
            });
        },

        updateSession: async ({meetingCode, memberId, sessionId}: {meetingCode: string, memberId: string, sessionId: string}) => {
            await pool.query(
                `
                    INSERT INTO sessions (meeting_code, member_id, session_id, last_alive)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (session_id)
                    DO UPDATE SET last_alive = excluded.last_alive
                `,
                [meetingCode, memberId, sessionId, Instant.now().toString()],
            );
        },

        close: async () => {
            await pool.end();
        },
    };
}

function decodeMeeting(value: t.OutputOf<typeof Meeting>): Meeting {
    const decodeResult = Meeting.decode(value);
    if (isLeft(decodeResult)) {
        throw new Error("could not decode value from store");
    } else {
        return decodeResult.right;
    }
}

function meetingCodeToLockId(meetingCode: string): number {
    // Based on the hash code for Java strings
    let hash = 0;
    for (let index = 0; index < meetingCode.length; index++) {
        hash = ((hash << 5) - hash) + meetingCode.charCodeAt(index);
        // Coerce to 32-bit int
        hash |= 0;
    }
    return hash;
}
