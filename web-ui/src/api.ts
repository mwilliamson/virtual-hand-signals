import { pipe } from "fp-ts/function";
import { fold } from "fp-ts/Either";

import { ClientMessage, ClientMessages, Meeting, ServerMessage, Update } from "server/lib/meetings";

export async function fetchMeetingByMeetingCode(meetingCode: string): Promise<Meeting | null> {
    const url = buildHttpUrl(`/api/meetings/${meetingCode}`);
    const response = await fetch(url);
    if (response.status === 200) {
        // TODO: decode response with io-ts
        const meeting: Meeting = await response.json();
        return meeting;
    } else if (response.status === 404) {
        return null;
    } else {
        throw new Error("response had status code: " + response.status);
    }
}

export function joinMeeting({meetingCode, onError, onInit, onUpdate}: {
    meetingCode: string,
    onError: (error: Error) => void,
    onInit: (x: {meeting: Meeting, memberId: string}) => void,
    onUpdate: (update: Update) => void,
}) {
    const url = buildUrl(webSocketProtocol(), `/api/meetings/${meetingCode}`);
    const socket = new WebSocket(url);

    socket.onmessage = event => {
        // TODO: handle non-JSON message
        const messageJson = JSON.parse(event.data) as ServerMessage;
        // TODO: handle decode failure
        pipe(ServerMessage.decode(messageJson), fold(
            () => {},
            message => {
                if (message.type === "initial") {
                    onInit(message);
                } else if (message.type === "invalid") {
                    // TODO: handle this
                } else {
                    onUpdate(message);
                }
            },
        ));
    };

    socket.onerror = () => {
        onError(new Error("failed to connect"));
    };

    // TODO: handle close

    return {
        send: (message: ClientMessage) => {
            socket.send(JSON.stringify(ClientMessages.toJson(message)));
        },
        close: () => {
            socket.close();
        },
    };
}

export async function startMeeting(): Promise<Meeting> {
    return postJson<Meeting>("/api/meetings");
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
