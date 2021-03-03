import * as http from "http";
import * as path from "path";
import * as url from "url";

import cors from "cors";
import cryptoRandomString from "crypto-random-string";
import express from "express";
import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import { Duration, Instant } from "@js-joda/core";
import * as uuid from "uuid";
import WebSocket from "ws";

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

export function createServer({port, databaseConnection}: {
    port: number,
    databaseConnection: database.Connection,
}) {
    // session expiration should be significantly longer than ping interval,
    // otherwise all sessions will expire
    const pingInterval = Duration.ofSeconds(10);
    const reapInterval = Duration.ofSeconds(19);
    const sessionExpiration = Duration.ofSeconds(30);

    const meetingSet = createMeetingSet({
        databaseConnection,
        send: sendServerMessage,

        reapInterval,
        sessionExpiration,
    });

    const app = express();
    app.use(express.json());
    app.use(cors());

    const CreateMeetingRequestBody = t.union([
        t.undefined,
        t.partial({
            hasQueue: t.boolean,
        }),
    ]);

    app.post("/api/meetings", async (request, response, next) => {
        try {
            const bodyResult = CreateMeetingRequestBody.decode(request.body);
            if (isLeft(bodyResult)) {
                response.status(400).send();
            } else {
                const meeting = await meetingSet.addMeeting(bodyResult.right);
                response.send(Meeting.encode(meeting));
            }
        } catch (error) {
            next(error);
        }
    });

    app.get("/api/meetings/:meetingCode", async (request, response, next) => {
        try {
            const {meetingCode} = request.params;
            const meeting = await databaseConnection.fetchMeetingByMeetingCode(meetingCode);
            if (meeting === undefined) {
                response.status(404).send();
            } else {
                response.send(Meeting.encode(meeting));
            }
        } catch (error) {
            next(error);
        }
    });

    const staticPath = path.join(__dirname, "../../web-ui/build");
    app.use(express.static(staticPath))

    app.get("*", (request, response) => {
        response.sendFile(path.resolve(staticPath, "index.html"));
    });

    const server = http.createServer(app);

    const wss = new WebSocket.Server({noServer: true});

    const initConnection = async (ws: WebSocket, session: Session) => {
        let ponged = true;
        ws.on("pong", () => {
            ponged = true;
            session.update();
        });

        const intervalId = setInterval(() => {
            if (!ponged) {
                ws.terminate();
            } else {
                ponged = false;
                ws.ping();
            }
        }, pingInterval.toMillis());

        async function processMessageJson(messageJson: unknown): Promise<void> {
            const decodeResult = ClientMessage.decode(messageJson);
            if (isLeft(decodeResult)) {
                sendServerMessage(ws, ServerMessages.invalid(messageJson));
            } else {
                const message = decodeResult.right;
                await session.processMessage(message);
            }
        }

        ws.on("close", () => {
            session.end();
            clearInterval(intervalId);
        });

        ws.on("message", function incoming(messageBuffer) {
            const messageJson = JSON.parse(messageBuffer.toString());
            processMessageJson(messageJson);
        });
    }

    wss.on("connection", async function connection(ws, request) {
        const meetingCode = (request as any).meetingCode as string;
        const session = await meetingSet.startSession(meetingCode, ws);

        if (session === null) {
            sendServerMessage(ws, ServerMessages.notFound);
            ws.close();
        } else {
            initConnection(ws, session);
        }
    });

    server.on("upgrade", function upgrade(request, socket, head) {
        const requestPath = url.parse(request.url).pathname;
        const result = requestPath && /^\/api\/meetings\/([^\/]+)$/.exec(requestPath);
        if (result === null) {
            socket.destroy();
        } else {
            const meetingCode = result[1];

            request.meetingCode = meetingCode;
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit("connection", ws, request);
            });
        }
    });

    server.on("close", () => {
        meetingSet.close();
    });

    server.listen(port);

    return server;
}

interface Session {
    end: () => Promise<void>;
    update: () => void;
    processMessage: (message: ClientMessage) => Promise<void>;
}

function createMeetingSet<Client>({databaseConnection, send, reapInterval, sessionExpiration}: {
    databaseConnection: database.Connection,
    send: (client: Client, message: ServerMessage) => void,

    reapInterval: Duration,
    sessionExpiration: Duration,
}) {
    async function addMeeting({hasQueue = false}: {hasQueue?: boolean} = {}): Promise<Meeting> {
        while (true) {
            // TODO: extract meeting code creation
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

        startSession: startSession,
        close: () => {
            clearInterval(reapSessionsIntervalId);
        },
    };
}

function sendServerMessage(client: WebSocket, message: ServerMessage): void {
    client.send(JSON.stringify(ServerMessages.toJson(message)));
}

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}

async function main() {
    const port = parseInt(process.env.PORT || "8000", 10);

    const databaseConnection = await connectToDatabaseFromEnv();

    await createServer({
        port: port,
        databaseConnection: databaseConnection,
    });
    console.log(`server started on port ${port}`);
}

async function connectToDatabaseFromEnv() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw Error("DATABASE_URL must be set");
    }
    return await database.connect(url);
}

if (require.main === module) {
    main();
}
