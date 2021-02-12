import * as http from "http";
import * as url from "url";

import serveHandler from "serve-handler";
import WebSocket from "ws";

const webSocketPath = "/websocket";

function createServer({port}: {port: number}) {

    const server = http.createServer(function (request, response) {
        serveHandler(request, response, {
            cleanUrls: false,
        });
    });

    console.log(`Server URI: ws://0.0.0.0:${port}${webSocketPath}`);

    const wss = new WebSocket.Server({noServer: true});

    const messages: Array<string> = [];

    wss.on("connection", function connection(ws) {
        const intervalId = setInterval(() => {
            ws.ping();
        }, 1000);

        messages.forEach(message => ws.send(message));

        ws.on("close", () => {
            clearInterval(intervalId);
        });

        ws.on("message", function incoming(payload) {
            const message = JSON.stringify({
                index: messages.length,
                payload: payload,
            });
            messages.push(message);
            wss.clients.forEach((ws) => ws.send(message));
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
}

if (require.main === module) {
    const port = parseInt(process.env.PORT || "8000", 10);
    createServer({port: port});
}
