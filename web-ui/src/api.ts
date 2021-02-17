import { isLeft, Left } from "fp-ts/Either";
import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";

import { ClientMessage, ClientMessages, Meeting, ServerMessage, Update } from "server/lib/meetings";

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

export function joinMeeting({meetingCode, onFatal, onError, onNotFound, onInit, onUpdate}: {
    meetingCode: string,
    onFatal: (error: Error) => void,
    onError: (error: Error) => void,
    onNotFound: () => void,
    onInit: (x: {meeting: Meeting, memberId: string}) => void,
    onUpdate: (update: Update) => void,
}) {
    const url = buildUrl(webSocketProtocol(), `/api/meetings/${meetingCode}`);
    const socket = new WebSocket(url);
    let open = false;

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
            if (message.type === "initial") {
                onInit(message);
            } else if (message.type === "invalid") {
                onError(new Error(`sent invalid message: ${JSON.stringify(message.message)}`));
            } else if (message.type === "notFound") {
                open = false;
                onNotFound();
            } else {
                onUpdate(message);
            }
        }
    };

    socket.onerror = () => {
        onFatal(new Error("failed to connect"));
    };

    socket.onopen = () => {
        open = true;
    };

    socket.onclose = () => {
        if (open) {
            onFatal(new Error("WebSocket was closed"));
            open = false;
        }
    };

    return {
        send: (message: ClientMessage) => {
            socket.send(JSON.stringify(ClientMessages.toJson(message)));
        },
        close: () => {
            open = false;
            socket.close();
        },
    };
}

export async function startMeeting(): Promise<Meeting> {
    const json = await postJson<Meeting>("/api/meetings");
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

async function postJson<T>(path: string): Promise<T> {
    const url = buildHttpUrl(path);
    const response = await fetch(url, {
        method: "POST",
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
