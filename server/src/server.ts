import * as http from "http";
import * as path from "path";
import * as url from "url";

import cors from "cors";
import express from "express";
import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import { Duration, Instant } from "@js-joda/core";
import * as pg from "pg";
import * as uuid from "uuid";
import WebSocket from "ws";

import { ConnectionRepository, createConnectionRepository } from "./connections";
import {
    applyUpdate,
    ClientMessage,
    clientMessageToUpdate,
    Meeting,
    ServerMessage,
    ServerMessages,
    Update,
    Updates,
} from "./meetings";
import { createMeetingRepository, MeetingRepository, MeetingStore } from "./meetingRepositories";
import * as store from "./store";

export function createServer({port, connectionRepository, meetingRepository}: {
    port: number,
    connectionRepository: ConnectionRepository,
    meetingRepository: MeetingRepository,
}) {
    // Inactivity is detected by pings, so we should make sure the ping
    // interval is considerably less than the inactivityInterval
    const inactivityInterval = Duration.ofSeconds(20);
    const pingInterval = Duration.ofSeconds(10);

    function startConnectionReaper() {
        async function reap() {
            const inactiveConnections = await connectionRepository.fetchInactive(inactivityInterval);
            for (const connection of inactiveConnections) {
                processUpdate(
                    connection.meetingCode,
                    Updates.leave({memberId: connection.memberId}),
                );
            }
        }

        setInterval(reap, inactivityInterval.toMillis());
    }

    startConnectionReaper();

    const webSocketClientsByMeetingCode = new Map<string, Set<WebSocket>>();

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
                const {hasQueue = false} = bodyResult.right ?? {};
                const meeting = await meetingRepository.createMeeting({hasQueue: hasQueue});
                response.send(Meeting.encode(meeting));
            }
        } catch (error) {
            next(error);
        }
    });

    app.get("/api/meetings/:meetingCode", async (request, response, next) => {
        try {
            const {meetingCode} = request.params;
            const meeting = await meetingRepository.get(meetingCode);
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

    function send(client: WebSocket, message: ServerMessage): void {
        client.send(JSON.stringify(ServerMessages.toJson(message)));
    }

    async function processUpdate(meetingCode: string, update: Update): Promise<void> {
        await meetingRepository.update(
            meetingCode,
            // TODO: Handle undefined meeting
            maybeMeeting => {
                const meeting = maybeMeeting!!;
                return applyUpdate(meeting, update);
            },
        );
        const meetingWebSocketClients = webSocketClientsByMeetingCode.get(meetingCode) ?? new Set();
        meetingWebSocketClients.forEach((ws) => send(ws, update));
    }

    const initConnection = async (ws: WebSocket, initialMeeting: Meeting) => {
        const {meetingCode} = initialMeeting;

        if (!webSocketClientsByMeetingCode.has(meetingCode)) {
            webSocketClientsByMeetingCode.set(meetingCode, new Set());
        }
        const meetingWebSocketClients = webSocketClientsByMeetingCode.get(meetingCode)!!;
        meetingWebSocketClients.add(ws);

        let ponged = true;
        ws.on("pong", () => ponged = true);

        const memberId = uuid.v4();

        async function markConnectionActive() {
            await connectionRepository.add({
                meetingCode: initialMeeting.meetingCode,
                memberId: memberId,
                lastActive: Instant.now(),
            });
        }

        await markConnectionActive()

        const intervalId = setInterval(() => {
            if (!ponged) {
                ws.terminate();
            } else {
                ponged = false;
                ws.ping();
                markConnectionActive();
            }
        }, pingInterval.toMillis());

        send(ws, ServerMessages.initial({meeting: initialMeeting, memberId}));

        async function processMessage(message: ClientMessage): Promise<void> {
            const update = clientMessageToUpdate(memberId, message);
            if (update === null) {
                send(ws, ServerMessages.invalid(message));
            } else {
                await processUpdate(meetingCode, update);
            }
        }

        ws.on("close", () => {
            meetingWebSocketClients.delete(ws);
            clearInterval(intervalId);
            processUpdate(meetingCode, Updates.leave({memberId}));
        });

        ws.on("message", function incoming(messageBuffer) {
            const message = JSON.parse(messageBuffer.toString());
            processMessage(message);
        });
    }

    wss.on("connection", async function connection(ws, request) {
        const meetingCode = (request as any).meetingCode as string;
        const initialMeeting: Meeting | null = await meetingRepository.get(meetingCode) ?? null;

        if (initialMeeting === null) {
            send(ws, ServerMessages.notFound);
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

    server.listen(port);

    return server;
}

async function main() {
    const port = parseInt(process.env.PORT || "8000", 10);

    const connectionRepository = await createConnectionRepository();
    const meetingRepository = await createMeetingRepositoryFromEnv();

    await createServer({
        port: port,
        connectionRepository: connectionRepository,
        meetingRepository: meetingRepository,
    });
    console.log(`server started on port ${port}`);
}

async function createMeetingRepositoryFromEnv() {
    const meetingStore: MeetingStore = process.env.DATABASE_URL
        ? await store.postgres({
            pool: new pg.Pool({connectionString: process.env.DATABASE_URL}),
            tableName: "meetings",
        })
        : await store.inMemory()

    return await createMeetingRepository({meetingStore});
}

if (require.main === module) {
    main();
}
