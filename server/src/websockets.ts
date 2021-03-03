import { Duration } from "@js-joda/core";
import WebSocket from "ws";

export function setUpWebSocketHeartbeat({webSocket, pingInterval, onHeartbeat}: {
    webSocket: WebSocket,
    pingInterval: Duration,
    onHeartbeat: () => void;
}) {
    let ponged = true;
    webSocket.on("pong", () => {
        ponged = true;
        onHeartbeat();
    });

    const intervalId = setInterval(() => {
        if (!ponged) {
            webSocket.terminate();
        } else {
            ponged = false;
            webSocket.ping();
        }
    }, pingInterval.toMillis());

    webSocket.on("close", () => {
        clearInterval(intervalId);
    });
}
