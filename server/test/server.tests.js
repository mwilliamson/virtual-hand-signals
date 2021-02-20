const assert = require("assert");
const util = require("util");

const axios = require("axios");
const WebSocket = require("ws");

const {createServer} = require("../lib/server");

const TEST_PORT = 8001;

suite(__filename, function() {
    test("attempting to get non-existent meeting causes 404", withServer(async (server) => {
       const response = await server.get("/api/meetings/abc-def-hij");

       assert.strictEqual(response.status, 404);
    }));

    test("attempting to connect non-existent meeting causes connection to close with message", withServer(async (server) => {
        const webSocket = await server.ws("/api/meetings/abc-def-hij");

        const message = await webSocket.waitForMessage("notFound");
        assert.deepStrictEqual(message, {type: "notFound"});

        await webSocket.waitForClose();
    }));

    test("POSTing to /api/meetings creates meeting that can be GETed", withServer(async (server) => {
        const {data: {meetingCode}} = await server.postOk("/api/meetings");

        const response = await server.get(`/api/meetings/${meetingCode}`);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.data.meetingCode, meetingCode);
        assert.deepStrictEqual(response.data.members, []);
    }));

    test("meeting has no queue by default", withServer(async (server) => {
        const {data: {meetingCode}} = await server.postOk("/api/meetings");

        const response = await server.get(`/api/meetings/${meetingCode}`);

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data.queue, null);
    }));

    test("meeting can be created with queue", withServer(async (server) => {
        const {data: {meetingCode}} = await server.postOk("/api/meetings", {hasQueue: true});

        const response = await server.get(`/api/meetings/${meetingCode}`);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.data.queue, []);
    }));

    test("POSTing to /api/meetings creates meeting that can be joined", withServer(async (server) => {
        const {data: {meetingCode}} = await server.postOk("/api/meetings");
        const webSocket = server.ws(`/api/meetings/${meetingCode}`);

        const initial = await webSocket.waitForMessage("initial");
        webSocket.send({type: "join", name: "Bob"});
        const join = await webSocket.waitForMessage("join");

        assert.strictEqual(initial.meeting.meetingCode, meetingCode);
        assert.deepStrictEqual(join, {type: "join", memberId: initial.memberId, name: "Bob"});
    }));

    test("when event is sent to server then server sends processed event to all clients", withServer(async (server) => {
        const {data: {meetingCode}} = await server.postOk("/api/meetings");

        const webSocket1 = server.ws(`/api/meetings/${meetingCode}`);
        const {memberId: memberId1} = await webSocket1.waitForMessage("initial");
        webSocket1.send({type: "join", name: "Bob"});
        const webSocket2 = server.ws(`/api/meetings/${meetingCode}`);
        await webSocket2.waitForMessage("initial");
        webSocket2.send({type: "join", name: "Alice"});

        webSocket1.send({type: "setName", name: "Robert"});
        const message1 = await webSocket1.waitForMessage("setName");
        const message2 = await webSocket2.waitForMessage("setName");

        assert.deepStrictEqual(message1, {type: "setName", memberId: memberId1, name: "Robert"});
        assert.deepStrictEqual(message2, {type: "setName", memberId: memberId1, name: "Robert"});
    }));

    test("joining client receives current state of meeting", withServer(async (server) => {
        const {data: {meetingCode}} = await server.postOk("/api/meetings");

        const webSocket1 = server.ws(`/api/meetings/${meetingCode}`);
        const {memberId: memberId1} = await webSocket1.waitForMessage("initial");
        webSocket1.send({type: "join", name: "Bob"});
        await webSocket1.waitForMessage("join");

        const webSocket2 = server.ws(`/api/meetings/${meetingCode}`);
        const message2 = await webSocket2.waitForMessage("initial");

        assert.deepStrictEqual(
            message2.meeting.members,
            [
                [memberId1, {memberId: memberId1, name: "Bob", handSignal: null}],
            ],
        );
    }));

    test("when client sends invalid message then that client receives invalid message response", withServer(async (server) => {
        const {data: {meetingCode}} = await server.postOk("/api/meetings");

        const webSocket1 = server.ws(`/api/meetings/${meetingCode}`);
        await webSocket1.waitForMessage("initial");
        webSocket1.send({type: "join", bob: "Bob"});
        const message1 = await webSocket1.waitForMessage("invalid");

        assert.deepStrictEqual(message1, {type: "invalid", message: {type: "join", bob: "Bob"}});
    }));

    test("when message has extra properties then update strips extra properties", withServer(async (server) => {
        // TODO: should be erroring in this case?
        // See: https://github.com/gcanti/io-ts/issues/322
        const {data: {meetingCode}} = await server.postOk("/api/meetings");

        const webSocket1 = server.ws(`/api/meetings/${meetingCode}`);
        const {memberId: memberId1} = await webSocket1.waitForMessage("initial");
        webSocket1.send({type: "join", name: "Bob", x: 1});
        const message1 = await webSocket1.waitForMessage("join");

        assert.deepStrictEqual(message1, {type: "join", memberId: memberId1, name: "Bob"});
    }));
});

async function postOk(url, data) {
    const response = await axios.post(url, data);
    assert.strictEqual(200, response.status);
    return response;
}

function wrapWebSocket(ws) {
    const events = [];
    let eventIndex = 0;
    let waiting = null;

    function storeEvent(name, value) {
        events.push({name, value});
        if (waiting !== null) {
            const w = waiting;
            waiting = null;
            handleWait(...w);
        }
    }

    function wait(description, predicate) {
        return new Promise((resolve, reject) => {
            handleWait(predicate, resolve, reject);

            setTimeout(() => reject(new Error(`timed out waiting for ${description}`)), 500);
        });
    }

    function handleWait(predicate, resolve, reject) {
        while (eventIndex < events.length) {
            const event = events[eventIndex];
            eventIndex++;

            if (predicate(event)) {
                resolve(event.value);
                return;
            }
        }
        waiting = [predicate, resolve, reject];
    }

    ws.on("close", () => storeEvent("close", null));
    ws.on("error", error => storeEvent("error", error));
    ws.on("message", data => storeEvent("message", JSON.parse(data)));

    return {
        send(message) {
            ws.send(JSON.stringify(message));
        },

        waitForClose() {
            return wait("close", event => event.name === "close");
        },

        waitForError() {
            return wait("error", event => event.name === "error");
        },

        waitForMessage(type) {
            return wait(
                `message of type ${type}`,
                 event => event.name === "message" && event.value.type === type,
            );
        },
    };
}

function withServer(func) {
    return async () => {
        const server = createServer({port: TEST_PORT});
        const webSockets = [];

        try {
            await func({
                get(url) {
                    return axios.get(`http://localhost:${TEST_PORT}${url}`, {validateStatus: null});
                },

                async postOk(url, data) {
                    return postOk(`http://localhost:${TEST_PORT}${url}`, data);
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
