import * as http from "http";
import * as url from "url";

import cryptoRandomString from "crypto-random-string";
import express from "express";
import serveHandler from "serve-handler";
import * as uuid from "uuid";
import WebSocket from "ws";

const webSocketPath = "/websocket";

interface Meeting {
    meetingCode: string;
}

type Message =
    | {type: "setName", name: string};

export function createServer({port}: {port: number}) {
    const app = express();

    app.post("/api/meetings", (request, response) => {
        const meetingCode = generateMeetingCode();
        const meeting = {meetingCode: meetingCode};
        meetings.set(meetingCode, meeting);
        response.send(meeting);
    });
    
    const server = http.createServer(app);

    console.log(`Server URI: ws://0.0.0.0:${port}${webSocketPath}`);

    const wss = new WebSocket.Server({noServer: true});

    const meetings = new Map<string, Meeting>();

    function processMessage(memberId: string, message: Message) {
        return {...message, memberId: memberId};
    }

    wss.on("connection", function connection(ws, request) {
        const memberId = uuid.v4();
    
        const intervalId = setInterval(() => {
            ws.ping();
        }, 1000);

        const meeting = (request as any).meeting as Meeting;
        
        ws.send(JSON.stringify({
            meeting: meeting,
            memberId: memberId,
        }));

        ws.on("close", () => {
            clearInterval(intervalId);
        });

        ws.on("message", function incoming(messageString) {
            const message = JSON.parse(messageString.toString());
            const processedMessage = processMessage(memberId, message);
            wss.clients.forEach((ws) => ws.send(JSON.stringify(processedMessage)));
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

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}

if (require.main === module) {
    const port = parseInt(process.env.PORT || "8000", 10);
    createServer({port: port});
}
