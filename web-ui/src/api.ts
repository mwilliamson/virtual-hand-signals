import { pipe } from "fp-ts/function";
import { fold, isLeft } from "fp-ts/Either";
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

export function joinMeeting({meetingCode, onFatal, onError, onInit, onUpdate}: {
    meetingCode: string,
    onFatal: (error: Error) => void,
    onError: (error: Error) => void,
    onInit: (x: {meeting: Meeting, memberId: string}) => void,
    onUpdate: (update: Update) => void,
}) {
    const url = buildUrl(webSocketProtocol(), `/api/meetings/${meetingCode}`);
    const socket = new WebSocket(url);

    // TODO: handle meeting doesn't exist (change server to allow connection and send appropriate message?)

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
                    onError(new Error(`sent invalid message: ${JSON.stringify(message.message)}`));
                } else {
                    onUpdate(message);
                }
            },
        ));
    };

    socket.onerror = () => {
        onFatal(new Error("failed to connect"));
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
    const json = await postJson<Meeting>("/api/meetings");
    return decodeMeetingJson(json);
}

function decodeMeetingJson(json: unknown): Meeting {
    const result = Meeting.decode(json);
    if (isLeft(result)) {
        throw new Error(PathReporter.report(result).join("\n"));
    } else {
        return result.right;
    }
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
