import * as http from "http";
import * as url from "url";

import express from "express";
import serveHandler from "serve-handler";
import * as uuid from "uuid";
import WebSocket from "ws";

import {applyUpdate, createMeeting, Meeting, Message, Update} from "./meetings";

export function createServer({port}: {port: number}) {
    const app = express();

    app.post("/api/meetings", (request, response) => {
        const meeting = createMeeting();
        meetings.set(meeting.meetingCode, meeting);
        response.send(meeting);
    });
    
    const server = http.createServer(app);

    const wss = new WebSocket.Server({noServer: true});

    const meetings = new Map<string, Meeting>();

    wss.on("connection", function connection(ws, request) {
        const memberId = uuid.v4();
    
        const intervalId = setInterval(() => {
            ws.ping();
        }, 1000);

        const meeting = (request as any).meeting as Meeting;

        ws.send(JSON.stringify({
            type: "initial",
            meeting: meeting,
            memberId: memberId,
        }));

        processUpdate({type: "join", memberId: memberId, name: "Anonymous"});

        function send(client: WebSocket, message: unknown): void {
            client.send(JSON.stringify(message));
        }

        function processMessage(message: Message): void {
            // Explicitly include members rather than splatting to avoid including extra properties
            const update: Update = {type: "setName", memberId: memberId, name: message.name};
            processUpdate(update);
        }

        function processUpdate(update: Update): void {
            applyUpdate(meeting, update);
            wss.clients.forEach((ws) => send(ws, update));
        }
        
        ws.on("close", () => {
            clearInterval(intervalId);
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
