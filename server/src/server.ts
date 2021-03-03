import * as http from "http";
import * as path from "path";
import * as url from "url";

import cors from "cors";
import express from "express";
import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import { Duration } from "@js-joda/core";
import WebSocket from "ws";

import * as database from "./database";
import { createMeetingManager, Session } from "./meetingManagers";
import {
    ClientMessage,
    Meeting,
    ServerMessage,
    ServerMessages,
} from "./meetings";
import { setUpWebSocketHeartbeat } from "./websockets";

export function createServer({port, databaseConnection}: {
    port: number,
    databaseConnection: database.Connection,
}) {
    // session expiration should be significantly longer than ping interval,
    // otherwise all sessions will expire
    const pingInterval = Duration.ofSeconds(10);
    const reapInterval = Duration.ofSeconds(19);
    const sessionExpiration = Duration.ofSeconds(30);

    const meetingManager = createMeetingManager({
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
                const meeting = await meetingManager.addMeeting(bodyResult.right);
                response.send(Meeting.encode(meeting));
            }
        } catch (error) {
            next(error);
        }
    });

    app.get("/api/meetings/:meetingCode", async (request, response, next) => {
        try {
            const {meetingCode} = request.params;
            const meeting = await meetingManager.fetchMeetingByMeetingCode(meetingCode);
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
        setUpWebSocketHeartbeat({
            webSocket: ws,
            pingInterval: pingInterval,
            onHeartbeat: () => session.update(),
        });

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
        });

        ws.on("message", function incoming(messageBuffer) {
            const messageJson = JSON.parse(messageBuffer.toString());
            processMessageJson(messageJson);
        });
    }

    wss.on("connection", async function connection(ws, request) {
        const meetingCode = (request as any).meetingCode as string;
        const session = await meetingManager.startSession(meetingCode, ws);

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
        meetingManager.close();
    });

    server.listen(port);

    return server;
}

function sendServerMessage(client: WebSocket, message: ServerMessage): void {
    client.send(JSON.stringify(ServerMessages.toJson(message)));
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
