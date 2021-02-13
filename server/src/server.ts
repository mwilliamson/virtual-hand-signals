import * as http from "http";
import * as url from "url";

import cors from "cors";
import express from "express";
import * as uuid from "uuid";
import WebSocket from "ws";

import {
    applyUpdate,
    ClientMessage,
    clientMessageToUpdate,
    createMeeting,
    Meeting,
    ServerMessage,
    ServerMessages,
    Update,
} from "./meetings";

export function createServer({port}: {port: number}) {
    const meetings = new Map<string, Meeting>();

    const saveMeeting = (meeting: Meeting) => meetings.set(meeting.meetingCode, meeting);
    
    const app = express();

    app.use(cors());

    app.post("/api/meetings", (request, response) => {
        const meeting = createMeeting();
        saveMeeting(meeting);
        response.send(meeting);
    });
    
    const server = http.createServer(app);

    const wss = new WebSocket.Server({noServer: true});

    wss.on("connection", function connection(ws, request) {
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

        const initialMeeting = (request as any).meeting as Meeting;

        send(ws, ServerMessages.initial({meeting: initialMeeting, memberId}));

        processUpdate(ServerMessages.join({memberId}));

        function send(client: WebSocket, message: ServerMessage): void {
            client.send(JSON.stringify(ServerMessages.toJson(message)));
        }

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
    });

    server.on("upgrade", function upgrade(request, socket, head) {
        const requestPath = url.parse(request.url).pathname;
        const result = requestPath && /^\/api\/meetings\/([^\/]+)$/.exec(requestPath);
        const meeting = result === null ? null : meetings.get(result[1]) ?? null;
        if (meeting !== null) {
            request.meeting = meeting;
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit("connection", ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    server.listen(port);

    return server;
}

if (require.main === module) {
    const port = parseInt(process.env.PORT || "8000", 10);
    createServer({port: port});
}
