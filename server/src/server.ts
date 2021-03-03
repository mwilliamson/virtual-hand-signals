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
                while (true) {
                    const {hasQueue = false} = bodyResult.right ?? {};
                    // TODO: extract meeting code creation
                    const meetingCode = generateMeetingCode();
                    const meeting = Meetings.create({meetingCode, hasQueue});

                    if (await databaseConnection.createMeeting(meeting)) {
                        response.send(Meeting.encode(meeting));
                        return;
                    }
                }
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

    async function processUpdate(meetingCode: string, update: Update): Promise<void> {
        await databaseConnection.updateMeetingByMeetingCode(
            meetingCode,
            meeting => applyUpdate(meeting, update),
        );
        meetingSet.sendToMeetingClients(meetingCode, update);
    }

    const initConnection = async (ws: WebSocket, initialMeeting: Meeting) => {
        const {meetingCode} = initialMeeting;

        meetingSet.addClient(meetingCode, ws);

        const updateSession = async () => {
            await databaseConnection.updateSession({meetingCode, memberId, sessionId});
        };

        let memberId = uuid.v4();
        let sessionId = uuid.v4();
        await updateSession();

        let ponged = true;
        ws.on("pong", () => {
            ponged = true;
            updateSession();
        });

        const intervalId = setInterval(() => {
            if (!ponged) {
                ws.terminate();
            } else {
                ponged = false;
                ws.ping();
            }
        }, pingInterval.toMillis());

        const sendInitial = () => {
            sendServerMessage(ws, ServerMessages.initial({meeting: initialMeeting, memberId, sessionId}));
        };

        sendInitial();

        async function processMessageJson(messageJson: unknown): Promise<void> {
            const decodeResult = ClientMessage.decode(messageJson);
            if (isLeft(decodeResult)) {
                sendServerMessage(ws, ServerMessages.invalid(messageJson));
            } else {
                const message = decodeResult.right;
                if (message.type === "v1/rejoin") {
                    const session = await databaseConnection.fetchSessionBySessionId(message.sessionId);
                    if (session === undefined) {
                        sendServerMessage(ws, ServerMessages.invalid(messageJson));
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
        }

        ws.on("close", () => {
            meetingSet.removeClient(meetingCode, ws);
            clearInterval(intervalId);
            processUpdate(meetingCode, Updates.leave({memberId}));
        });

        ws.on("message", function incoming(messageBuffer) {
            const messageJson = JSON.parse(messageBuffer.toString());
            processMessageJson(messageJson);
        });
    }

    wss.on("connection", async function connection(ws, request) {
        const meetingCode = (request as any).meetingCode as string;
        const initialMeeting: Meeting | null =
            await databaseConnection.fetchMeetingByMeetingCode(meetingCode) ?? null;

        if (initialMeeting === null) {
            sendServerMessage(ws, ServerMessages.notFound);
            ws.close();
        } else {
            initConnection(ws, initialMeeting);
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

function createMeetingSet<Client>({databaseConnection, send, reapInterval, sessionExpiration}: {
    databaseConnection: database.Connection,
    send: (client: Client, message: ServerMessage) => void,

    reapInterval: Duration,
    sessionExpiration: Duration,
}) {
    const clientsByMeetingCode = new Map<string, Set<Client>>();

    function addClient(meetingCode: string, client: Client): void {
        getMeetingClients(meetingCode).add(client);
    }

    function removeClient(meetingCode: string, client: Client): void {
        getMeetingClients(meetingCode).delete(client);
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
        addClient: addClient,
        removeClient: removeClient,
        close: () => {
            clearInterval(reapSessionsIntervalId);
        },
        sendToMeetingClients: sendToMeetingClients,
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
