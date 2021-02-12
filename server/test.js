const assert = require("assert");

const axios = require("axios");
const WebSocket = require("ws");

const {createServer} = require("./server");

const TEST_PORT = 8001;

exports["POSTing to /api/meetings creates meeting that can be joined"] = withServer(async (server) => {
    const response = await postOk(`http://localhost:${TEST_PORT}/api/meetings`);
    const {meetingCode} = response.data;
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}/api/meetings/${meetingCode}`);
    try {
        const message = await awaitWsMessage(ws);

        assert.strictEqual(meetingCode, JSON.parse(message).meetingCode);
    } finally {
        ws.close();
    }
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
        try {
            await func(server);
        } finally {
            server.close();
        }
    };
}
