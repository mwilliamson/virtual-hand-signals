import { isLeft, Left } from "fp-ts/Either";
import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";

import { ClientMessage, ClientMessages, Meeting, ServerMessage, Update } from "server/lib/meetings";

export async function keepAlive(meetingCode: string): Promise<void> {
    await fetchMeetingByMeetingCode(meetingCode);
}

export async function fetchMeetingByMeetingCode(meetingCode: string): Promise<Meeting | null> {
    const url = buildHttpUrl(`/api/meetings/${meetingCode}`);
    const response = await fetch(url);
    if (response.status === 200) {
        const json = await response.json();
        return decodeMeetingJson(json);
    } else if (response.status === 404) {
        return null;
    } else {
        throw new Error("response had status code: " + response.status);
    }
}

export function joinMeeting({meetingCode, onConnectionError, onError, onNotFound, onInit, onUpdate}: {
    meetingCode: string,
    onConnectionError: (error: Error) => void,
    onError: (error: Error) => void,
    onNotFound: () => void,
    onInit: (x: {meeting: Meeting, memberId: string}) => void,
    onUpdate: (update: Update) => void,
}) {
    const url = buildUrl(webSocketProtocol(), `/api/meetings/${meetingCode}`);

    let sessionId: string | null = null;
    let socket: WebSocket | null = null;
    let open = false;
    let rejoining = false;
    let onRejoinFailure = () => {};

    function setUpSocket() {
        socket = new WebSocket(url);
        open = false;
        rejoining = false;

        socket.onmessage = event => {
            let messageJson: unknown;
            try {
                messageJson = JSON.parse(event.data);
            } catch (error) {
                onError(error);
                return;
            }

            const decodeResult = ServerMessage.decode(messageJson);
            if (isLeft(decodeResult)) {
                onError(decodeResultToError(decodeResult));
            } else {
                const message = decodeResult.right;
                if (message.type === "v1/initial") {
                    const init = () => {
                        sessionId = message.sessionId;
                        rejoining = false;
                        onInit(message);
                    };
                    if (sessionId === null || sessionId === message.sessionId) {
                        init();
                    } else {
                        send(ClientMessages.rejoin({sessionId}));
                        rejoining = true;
                        // TODO: automatically reuse name?
                        onRejoinFailure = init;
                    }
                } else if (message.type === "v1/invalid") {
                    if (rejoining) {
                        onRejoinFailure();
                    } else {
                        onError(new Error(`sent invalid message: ${JSON.stringify(message.message)}`));
                    }
                } else if (message.type === "v1/notFound") {
                    open = false;
                    onNotFound();
                } else {
                    onUpdate(message);
                }
            }
        };

        socket.onerror = () => {
            if (socket !== null) {
                socket.close();
            }
            onConnectionError(new Error("failed to connect"));
            reconnect();
        };

        socket.onopen = () => {
            open = true;
        };

        socket.onclose = () => {
            if (open) {
                onConnectionError(new Error("WebSocket was closed"));
                reconnect();
                open = false;
            }
        };
    }

    setUpSocket();

    let reconnectTimeoutId: number | null;

    function reconnect() {
        // TODO: backoff
        reconnectTimeoutId = window.setTimeout(() => setUpSocket(), 1000);
    }

    function send(message: ClientMessage) {
        // TODO: store pending messages?
        if (socket !== null) {
            socket.send(JSON.stringify(ClientMessages.toJson(message)));
        }
    }

    return {
        send: send,
        close: () => {
            open = false;
            if (socket !== null) {
                socket.close();
            }
            if (reconnectTimeoutId !== null) {
                clearTimeout(reconnectTimeoutId);
            }
        },
    };
}

export async function startMeeting({hasQueue}: {hasQueue: boolean}): Promise<Meeting> {
    const json = await postJson<Meeting>("/api/meetings", {hasQueue: hasQueue});
    return decodeMeetingJson(json);
}

function decodeMeetingJson(json: unknown): Meeting {
    const result = Meeting.decode(json);
    if (isLeft(result)) {
        throw decodeResultToError(result);
    } else {
        return result.right;
    }
}

function decodeResultToError(result: Left<t.Errors>): Error {
    return new Error(PathReporter.report(result).join("\n"));
}

async function postJson<T>(path: string, data: unknown): Promise<T> {
    const url = buildHttpUrl(path);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });
    if (response.status === 200) {
        return response.json();
    } else {
        throw new Error("response had status code: " + response.status);
    }
}

function buildHttpUrl(path: string) {
    return buildUrl(httpProtocol(), path);
}

function buildUrl(protocol: string, path: string) {
    return `${protocol}//${apiHost()}${path}`;
}

function webSocketProtocol() {
    return window.location.protocol === "http:" ? "ws:" : "wss:";
}

function httpProtocol() {
    return window.location.protocol;
}

function apiHost() {
    if (process.env.NODE_ENV === "development") {
        return "localhost:8000";
    } else {
        return window.location.host;
    }
}
