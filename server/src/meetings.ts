import cryptoRandomString from "crypto-random-string";

import {assertUnreachable} from "./types";

export interface Meeting {
    meetingCode: string;
    members: Array<Member>;
}

export interface Member {
    memberId: string;
    name: string;
}

export function createMeeting(): Meeting {
    const meetingCode = generateMeetingCode();
    return {meetingCode: meetingCode, members: []};
}

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}

export type Update =
    | {type: "join", memberId: string, name: string}
    | {type: "setName", memberId: string, name: string};

export type ServerMessage = Update | {type: "initial", memberId: string, meeting: Meeting};

export const ServerMessages = {
    initial({meeting, memberId}: {meeting: Meeting, memberId: string}): ServerMessage {
        return {
            type: "initial",
            meeting: meeting,
            memberId: memberId,
        };
    },

    join({memberId, name = "Anonymous"}: {memberId: string, name?: string}): Update {
        return {type: "join", memberId: memberId, name: name}
    },
}

export function applyUpdate(meeting: Meeting, update: Update): void {
    if (update.type === "join") {
        meeting.members.push({memberId: update.memberId, name: update.name});
    } else if (update.type === "setName") {
        const member = meeting.members.find(member => member.memberId === update.memberId);
        if (member === undefined) {
            throw new Error("no member with memberId: " + update.memberId);
        }
        
        member.name = update.name;
    } else {
        assertUnreachable(update, "unhandled update type: " + (update as Update).type);
    }
}

export type ClientMessage =
    | {type: "setName", name: string};

export function clientMessageToUpdate(memberId: string, message: ClientMessage): Update {
    // Explicitly include members rather than splatting to avoid including extra properties
    return {type: "setName", memberId: memberId, name: message.name};
}
