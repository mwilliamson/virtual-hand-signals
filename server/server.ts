import * as http from "http";
import * as url from "url";

import serveHandler from "serve-handler";
import WebSocket from "ws";

const webSocketPath = "/websocket";
const port = process.env.PORT || 8000;

const server = http.createServer(function (request, response) {
    serveHandler(request, response, {
        cleanUrls: false,
    });
});

console.log(`Server URI: ws://0.0.0.0:${port}${webSocketPath}`);

const wss = new WebSocket.Server({noServer: true});

let connections: Array<WebSocket> = [];
const messages: Array<string> = [];

wss.on("connection", function connection(ws) {
    connections.push(ws);

    const intervalId = setInterval(() => {
        ws.ping();
    }, 1000);

    messages.forEach(message => ws.send(message));

    ws.on("close", () => {
        connections = connections.filter(connection => connection != ws);
        clearInterval(intervalId);
    });

    ws.on("message", function incoming(payload) {
        const message = JSON.stringify({
            index: messages.length,
            payload: payload,
        });
        messages.push(message);
        connections.forEach((ws) => ws.send(message));
    });
});

server.on("upgrade", function upgrade(request, socket, head) {
    const requestPath = url.parse(request.url).pathname;

    if (requestPath === webSocketPath) {
        wss.handleUpgrade(request, socket, head, function done(ws) {
            wss.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
});

server.listen(port);
