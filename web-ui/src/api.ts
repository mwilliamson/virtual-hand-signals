import { pipe } from "fp-ts/function";
import { fold } from "fp-ts/Either";

import { Meeting, ServerMessage, Update } from "server/lib/meetings";

export function joinMeeting({meetingCode, onError, onInit, onUpdate}: {
    meetingCode: string,
    onError: (error: Error) => void,
    onInit: (meeting: Meeting) => void,
    onUpdate: (update: Update) => void,
}) {
    const url = `${webSocketProtocol()}//${apiHost()}/api/meetings/${meetingCode}`;
    const socket = new WebSocket(url);

    socket.onmessage = event => {
        // TODO: handle non-JSON message
        const messageJson = JSON.parse(event.data) as ServerMessage;
        // TODO: handle decode failure
        pipe(ServerMessage.decode(messageJson), fold(
            () => {},
            message => {
                if (message.type === "initial") {
                    onInit(message.meeting);
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
        close: () => {
            socket.close();
        },
    };
}

export async function startMeeting(): Promise<Meeting> {
    return postJson<Meeting>("/api/meetings");
}

async function postJson<T>(path: string): Promise<T> {
    const url = `${httpProtocol()}//${apiHost()}${path}`;
    const response = await fetch(url, {
        method: "POST",
    });
    if (response.status === 200) {
        return response.json();
    } else {
        throw new Error("response had status code: " + response.status);
    }
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
