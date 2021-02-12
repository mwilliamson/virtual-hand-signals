const assert = require("assert");
const util = require("util");

const axios = require("axios");
const WebSocket = require("ws");

const {createServer} = require("./server");

const TEST_PORT = 8001;

exports["attempting to non-existent meeting causes connection to be refused"] = withServer(async (server) => {
    const webSocket = await server.ws("/api/meetings/abc-def-hij");
    const error = await webSocket.wait("error");

    assert.strictEqual("ECONNRESET", error.code);
});

exports["POSTing to /api/meetings creates meeting that can be joined"] = withServer(async (server) => {
    const {data: {meetingCode}} = await server.postOk("/api/meetings");
    const webSocket = server.ws(`/api/meetings/${meetingCode}`);
    const message = await webSocket.wait("message");

    assert.strictEqual(meetingCode, message.meeting.meetingCode);
});

exports["when event is sent to server then server sends processed event to all clients"] = withServer(async (server) => {
    const {data: {meetingCode}} = await server.postOk("/api/meetings");
    
    const webSocket1 = server.ws(`/api/meetings/${meetingCode}`);
    const {memberId: memberId1} = await webSocket1.wait("message");
    const webSocket2 = server.ws(`/api/meetings/${meetingCode}`);
    await webSocket2.wait("message");

    webSocket1.send({type: "setName", name: "Bob"});
    const message1 = await webSocket1.wait("message");
    const message2 = await webSocket2.wait("message");

    assert.deepStrictEqual(message1, {type: "setName", memberId: memberId1, name: "Bob"});
    assert.deepStrictEqual(message2, {type: "setName", memberId: memberId1, name: "Bob"});
});

async function postOk(url) {
    const response = await axios.post(url);
    assert.strictEqual(200, response.status);
    return response;
}

function wrapWebSocket(ws) {
    let waitingForEvent = null;
    let resolve = null;
    let reject = null;

    function storeEvent(name, value) {
        if (name === waitingForEvent) {
            const r = resolve;
            waitingForEvent = null;
            resolve = null;
            reject = null;
            r(value);
        } else if (reject) {
            reject(new Error(`unexpected ${name} event: ${value}`));
        } else {
            // TODO: handle this properly!
        }
    }

    ws.on("message", data => storeEvent("message", JSON.parse(data)));
    ws.on("error", error => storeEvent("error", error));

    return {
        send(message) {
            ws.send(JSON.stringify(message));
        },
    
        wait(eventName) {
            waitingForEvent = eventName;
            return new Promise((promiseResolve, promiseReject) => {
                resolve = promiseResolve;
                reject = promiseReject;
            });
        },
    };
            
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
                    return wrapWebSocket(webSocket);
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
