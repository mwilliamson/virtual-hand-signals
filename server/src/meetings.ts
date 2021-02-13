import cryptoRandomString from "crypto-random-string";

import {assertUnreachable} from "./types";

export interface Meeting {
    meetingCode: string;
    members: Array<Member>;
}

const Meetings = {
    updateMemberByMemberId(meeting: Meeting, memberId: string, update: (member: Member) => void): void {
        const member = meeting.members.find(member => member.memberId === memberId);
        if (member === undefined) {
            throw new Error("no member with memberId: " + memberId);
        }
        
        update(member);
    },
};

export interface Member {
    memberId: string;
    name: string;
    handSignal: string | null;
}

const handSignals = [
    "agree",
    "disagree",
    "want to talk",
    "direct response",
    "clarification",
    "point of order",
];

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
    | {type: "setName", memberId: string, name: string}
    | {type: "setHandSignal", memberId: string, handSignal: string | null};

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
        meeting.members.push({memberId: update.memberId, name: update.name, handSignal: null});
    } else if (update.type === "setName") {
        Meetings.updateMemberByMemberId(meeting, update.memberId, member => {
            member.name = update.name;
        });
    } else if (update.type === "setHandSignal") {
        Meetings.updateMemberByMemberId(meeting, update.memberId, member => {
            member.handSignal = update.handSignal;
        });
    } else {
        assertUnreachable(update, "unhandled update type: " + (update as Update).type);
    }
}

export type ClientMessage =
    | {type: "setName", name: string}
    | {type: "setHandSignal", handSignal: string | null};

export function clientMessageToUpdate(memberId: string, message: ClientMessage): Update {
    // Explicitly include members rather than splatting to avoid including extra properties
    if (message.type === "setName") {
        return {type: "setName", memberId: memberId, name: message.name};
    } else if (message.type === "setHandSignal") {
        return {type: "setHandSignal", memberId: memberId, handSignal: message.handSignal};
    } else {
        return assertUnreachable(message, "unhandled client message type: " + (message as ClientMessage).type);
    }
}
