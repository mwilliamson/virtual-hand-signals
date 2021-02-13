import { Meeting } from "../../server/src/meetings";

export async function startMeeting(): Promise<Meeting> {
    return postJson<Meeting>("/api/meetings");
}

async function postJson<T>(url: string): Promise<T> {
    if (process.env.NODE_ENV === "development") {
        url = "http://localhost:8000" + url;
    }
    const response = await fetch(url, {
        method: "POST",
    });
    if (response.status === 200) {
        return response.json();
    } else {
        throw new Error("response had status code: " + response.status);
    }
}
