import cryptoRandomString from "crypto-random-string";
import { Duration, Instant } from "@js-joda/core";
import * as uuid from "uuid";

import * as database from "./database";
import { toMultiMap } from "./iterables";
import {
    applyUpdate,
    ClientMessage,
    clientUpdateToUpdate,
    Meeting,
    Meetings,
    ServerMessage,
    ServerMessages,
    Update,
    Updates,
} from "./meetings";

interface MeetingManager<Client> {
    addMeeting: (args: {hasQueue?: boolean} | undefined) => Promise<Meeting>;
    fetchMeetingByMeetingCode: (meetingCode: string) => Promise<Meeting | undefined>;

    startSession: (meetingCode: string, client: Client) => Promise<Session | null>;

    close: () => void;
}

export interface Session {
    end: () => Promise<void>;
    update: () => void;
    processMessage: (message: ClientMessage) => Promise<void>;
}

export function createMeetingManager<Client>({databaseConnection, send, reapInterval, sessionExpiration}: {
    databaseConnection: database.Connection,
    send: (client: Client, message: ServerMessage) => void,

    reapInterval: Duration,
    sessionExpiration: Duration,
}): MeetingManager<Client> {
    async function addMeeting({hasQueue = false}: {hasQueue?: boolean} = {}): Promise<Meeting> {
        while (true) {
            const meetingCode = generateMeetingCode();
            const meeting = Meetings.create({meetingCode, hasQueue});

            if (await databaseConnection.createMeeting(meeting)) {
                return meeting;
            }
        }
    }

    async function processUpdate(meetingCode: string, update: Update): Promise<void> {
        await databaseConnection.updateMeetingByMeetingCode(
            meetingCode,
            meeting => applyUpdate(meeting, update),
        );
        sendToMeetingClients(meetingCode, update);
    }


    const clientsByMeetingCode = new Map<string, Set<Client>>();

    async function startSession(meetingCode: string, client: Client): Promise<Session | null> {
        const initialMeeting = await databaseConnection.fetchMeetingByMeetingCode(meetingCode) ?? null;

        if (initialMeeting === null) {
            return null;
        }

        const meetingClients = getMeetingClients(meetingCode);
        meetingClients.add(client);

        const updateSession = async () => {
            await databaseConnection.updateSession({meetingCode, memberId, sessionId});
        };

        let memberId = uuid.v4();
        let sessionId = uuid.v4();
        await updateSession();

        const sendInitial = () => {
            send(client, ServerMessages.initial({meeting: initialMeeting, memberId, sessionId}));
        };

        sendInitial();

        async function processMessage(message: ClientMessage): Promise<void> {
            if (message.type === "v1/rejoin") {
                const session = await databaseConnection.fetchSessionBySessionId(message.sessionId);
                if (session === undefined) {
                    send(client, ServerMessages.invalid(message));
                } else {
                    // TODO: remove old session
                    memberId = session.memberId;
                    sessionId = session.sessionId;
                    updateSession();
                    sendInitial();
                }
            } else {
                await processUpdate(meetingCode, clientUpdateToUpdate(memberId, message));
            }
        }

        return {
            end: async () => {
                meetingClients.delete(client);
                await processUpdate(meetingCode, Updates.leave({memberId}));
            },

            update: updateSession,

            processMessage: processMessage,
        };
    }

    function getMeetingClients(meetingCode: string) {
        if (!clientsByMeetingCode.has(meetingCode)) {
            clientsByMeetingCode.set(meetingCode, new Set());
        }
        return clientsByMeetingCode.get(meetingCode)!!;
    }

    function sendToMeetingClients(meetingCode: string, message: ServerMessage) {
        const meetingClients = clientsByMeetingCode.get(meetingCode) ?? new Set();
        meetingClients.forEach(client => send(client, message));
    }

    const reapSessionsIntervalId = setInterval(() => {
        const minLastAlive = Instant.now().minus(sessionExpiration);

        databaseConnection.withTransaction(async (client) => {
            const rows = await client.deleteExpiredSessions(minLastAlive);
            const updatesByMeetingCode = toMultiMap(rows.map(row => {
                const {meetingCode, memberId} = row;
                const update = Updates.leave({memberId});
                return [meetingCode, update];
            }));
            for (const [meetingCode, updates] of updatesByMeetingCode) {
                const meetingClient = await client.acquireMeetingLock(meetingCode);
                await meetingClient.updateMeeting(
                    meeting => updates.reduce(
                        (currentMeeting, update) => applyUpdate(currentMeeting, update),
                        meeting,
                    ),
                );
                for (const update of updates) {
                    sendToMeetingClients(meetingCode, update);
                }
            }
        });
    }, reapInterval.toMillis());

    return {
        addMeeting: addMeeting,
        fetchMeetingByMeetingCode: databaseConnection.fetchMeetingByMeetingCode.bind(database),

        startSession: startSession,
        close: () => {
            clearInterval(reapSessionsIntervalId);
        },
    };
}

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}
