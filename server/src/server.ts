import * as http from "http";
import * as path from "path";
import * as url from "url";

import cors from "cors";
import express from "express";
import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";
import * as uuid from "uuid";
import WebSocket from "ws";

import {
    applyUpdate,
    ClientMessage,
    clientMessageToUpdate,
    Meeting,
    ServerMessage,
    ServerMessages,
    Update,
} from "./meetings";
import { createMeetingRepository } from "./meetingRepositories";
import * as store from "./store";

export async function createServer({port, meetingStore}: {
    port: number,
    meetingStore: store.Store<string, Meeting>,
}) {
    const meetings = await createMeetingRepository({meetingStore});

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
                const meeting = await meetings.createMeeting({hasQueue: hasQueue});
                response.send(Meeting.encode(meeting));
            }
        } catch (error) {
            next(error);
        }
    });

    app.get("/api/meetings/:meetingCode", async (request, response, next) => {
        try {
            const {meetingCode} = request.params;
            const meeting = await meetings.get(meetingCode);
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

    const initConnection = (ws: WebSocket, initialMeeting: Meeting) => {
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
        }, 10000);

        send(ws, ServerMessages.initial({meeting: initialMeeting, memberId}));

        async function processMessage(message: ClientMessage): Promise<void> {
            const update = clientMessageToUpdate(memberId, message);
            if (update === null) {
                send(ws, ServerMessages.invalid(message));
            } else {
                await processUpdate(update);
            }
        }

        async function processUpdate(update: Update): Promise<void> {
            // TODO: Handle undefined meeting
            await meetings.update(initialMeeting.meetingCode, meeting => applyUpdate(meeting!!, update));
            wss.clients.forEach((ws) => send(ws, update));
        }

        ws.on("close", () => {
            clearInterval(intervalId);
            processUpdate(ServerMessages.leave({memberId}));
        });

        ws.on("message", function incoming(messageBuffer) {
            const message = JSON.parse(messageBuffer.toString());
            processMessage(message);
        });
    }

    wss.on("connection", async function connection(ws, request) {
        const meetingCode = (request as any).meetingCode as string;
        const initialMeeting: Meeting | null = await meetings.get(meetingCode) ?? null;

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
    await createServer({port: port, meetingStore: store.inMemory()});
    console.log(`server started on port ${port}`);
}

if (require.main === module) {
    main();
}
