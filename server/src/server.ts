import * as http from "http";
import * as path from "path";
import * as url from "url";

import cors from "cors";
import express from "express";
import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import { Duration } from "@js-joda/core";
import * as pg from "pg";
import * as uuid from "uuid";
import WebSocket from "ws";

import {
    applyUpdate,
    ClientMessage,
    clientMessageToUpdate,
    Meeting,
    MeetingDetails,
    Meetings,
    ServerMessage,
    ServerMessages,
    Update,
    Updates,
} from "./meetings";
import {
    createMeetingRepository,
    MeetingRepository,
    MeetingStore,
 } from "./meetingRepositories";
import * as store from "./store";

export function createServer({port, meetingRepository}: {
    port: number,
    meetingRepository: MeetingRepository,
}) {
    const pingInterval = Duration.ofSeconds(10);

    interface Connection {
        clientWebSocket: WebSocket;
    }

    const connectionsByMeetingCode = new Map<string, Set<Connection>>();
    const meetingsByMeetingCode = new Map<string, Meeting>();

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
                response.send(MeetingDetails.encode(meeting));
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
                response.send(MeetingDetails.encode(meeting));
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
        const meeting = meetingsByMeetingCode.get(meetingCode);
        // TODO: Handle undefined meeting
        if (meeting !== undefined) {
            meetingsByMeetingCode.set(meetingCode, applyUpdate(meeting, update));
        }
        const meetingConnections = connectionsByMeetingCode.get(meetingCode) ?? new Set();
        meetingConnections.forEach(connection => send(connection.clientWebSocket, update));
    }

    const initConnection = async (ws: WebSocket, meetingDetails: MeetingDetails) => {
        const {meetingCode} = meetingDetails;

        if (!connectionsByMeetingCode.has(meetingCode)) {
            connectionsByMeetingCode.set(meetingCode, new Set());
        }
        if (!meetingsByMeetingCode.has(meetingCode)) {
            meetingsByMeetingCode.set(meetingCode, Meetings.create(meetingDetails));
        }

        const meetingConnections = connectionsByMeetingCode.get(meetingCode)!!;
        const connection = {clientWebSocket: ws};
        meetingConnections.add(connection);

        let ponged = true;
        ws.on("pong", () => ponged = true);

        const memberId = uuid.v4();

        const intervalId = setInterval(() => {
            if (!ponged) {
                ws.terminate();
            } else {
                ponged = false;
                ws.ping();
            }
        }, pingInterval.toMillis());

        const initialMeeting = meetingsByMeetingCode.get(meetingCode)!!;
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
            meetingConnections.delete(connection);
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
        const meetingDetails = await meetingRepository.get(meetingCode) ?? null;

        if (meetingDetails === null) {
            send(ws, ServerMessages.notFound);
            ws.close();
        } else {
            initConnection(ws, meetingDetails);
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

    const meetingRepository = await createMeetingRepositoryFromEnv();

    await createServer({
        port: port,
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
