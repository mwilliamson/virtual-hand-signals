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

export function createServer({port}: {port: number}) {
    const meetings = createMeetingRepository();

    const saveMeeting = (meeting: Meeting) => meetings.set(meeting.meetingCode, meeting);

    const app = express();
    app.use(express.json());
    app.use(cors());

    const CreateMeetingRequestBody = t.union([
        t.undefined,
        t.partial({
            hasQueue: t.boolean,
        }),
    ]);

    app.post("/api/meetings", (request, response) => {
        const bodyResult = CreateMeetingRequestBody.decode(request.body);
        if (isLeft(bodyResult)) {
            response.status(400).send();
        } else {
            const {hasQueue = false} = bodyResult.right ?? {};
            const meeting = meetings.createMeeting({hasQueue: hasQueue});
            saveMeeting(meeting);
            response.send(Meeting.encode(meeting));
        }
    });

    app.get("/api/meetings/:meetingCode", (request, response) => {
        const {meetingCode} = request.params;
        const meeting = meetings.get(meetingCode);
        if (meeting === undefined) {
            response.status(404).send();
        } else {
            response.send(Meeting.encode(meeting));
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
        }, 1000);

        send(ws, ServerMessages.initial({meeting: initialMeeting, memberId}));

        function processMessage(message: ClientMessage): void {
            const update = clientMessageToUpdate(memberId, message);
            if (update === null) {
                send(ws, ServerMessages.invalid(message));
            } else {
                processUpdate(update);
            }
        }

        function processUpdate(update: Update): void {
            // TODO: Handle undefined meeting
            const meeting = meetings.get(initialMeeting.meetingCode)!!;
            const newMeeting = applyUpdate(meeting, update);
            saveMeeting(newMeeting);
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

    wss.on("connection", function connection(ws, request) {
        const initialMeeting = (request as any).meeting as Meeting | null;

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
        const meeting: Meeting | null = result === null ? null : meetings.get(result[1]) ?? null;

        request.meeting = meeting;
        wss.handleUpgrade(request, socket, head, function done(ws) {
            wss.emit("connection", ws, request);
        });
    });

    server.listen(port);

    return server;
}

if (require.main === module) {
    const port = parseInt(process.env.PORT || "8000", 10);
    createServer({port: port});
    console.log(`server started on port ${port}`);
}
