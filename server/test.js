const assert = require("assert");

const axios = require("axios");
const WebSocket = require("ws");

const {createServer} = require("./server");

const TEST_PORT = 8001;

exports["POSTing to /api/meetings creates meeting that can be joined"] = withServer(async (server) => {
    const {data: {meetingCode}} = await server.postOk("/api/meetings");
    const ws = server.ws(`/api/meetings/${meetingCode}`);
    const message = await awaitWsMessage(ws);

    assert.strictEqual(meetingCode, JSON.parse(message).meetingCode);
});

async function postOk(url) {
    const response = await axios.post(url);
    assert.strictEqual(200, response.status);
    return response;
}

function awaitWsMessage(ws) {
    return new Promise(resolve => {
        ws.on("message", data => {
            resolve(data);
        })
    });
} 

function withServer(func) {
    return async () => {
        const server = createServer({port: TEST_PORT});
        const webSockets = [];
        
        try {
            await func({
                async postOk(url) {
                    return postOk(`http://localhost:${TEST_PORT}${url}`);
                },

                ws(url) {
                    const webSocket = new WebSocket(`ws://localhost:${TEST_PORT}${url}`);
                    webSockets.push(webSocket);
                    return webSocket;
                },
            });
        } finally {
            for (const webSocket of webSockets) {
                try {
                    webSocket.close();
                } catch (error) {
                    console.error(error);
                }
            }
            server.close();
        }
    };
}
