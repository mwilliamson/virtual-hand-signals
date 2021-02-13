import cryptoRandomString from "crypto-random-string";
import { pipe } from "fp-ts/function";
import { fold } from "fp-ts/Either";
import { List, updateIn } from "immutable";
import * as t from "io-ts";

import {assertUnreachable} from "./types";

export interface Meeting {
    meetingCode: string;
    members: List<Member>;
}

const Meetings = {
    updateMemberByMemberId(meeting: Meeting, memberId: string, update: (member: Member) => Member): Meeting {
        const memberIndex = meeting.members.findIndex(member => member.memberId === memberId);
        if (memberIndex === -1) {
            throw new Error("no member with memberId: " + memberId);
        }
        
        return updateIn(meeting, ["members", memberIndex], update);
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
    return {meetingCode: meetingCode, members: List()};
}

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}

export type Update =
    | {type: "join", memberId: string, name: string}
    | {type: "setName", memberId: string, name: string}
    | {type: "setHandSignal", memberId: string, handSignal: string | null};

export type ServerMessage =
    | Update
    | {type: "initial", memberId: string, meeting: Meeting}
    | {type: "invalid", message: unknown};

export const ServerMessages = {
    initial({meeting, memberId}: {meeting: Meeting, memberId: string}): ServerMessage {
        return {
            type: "initial",
            meeting: meeting,
            memberId: memberId,
        };
    },

    invalid(message: unknown): ServerMessage {
        return {type: "invalid", message: message};
    },

    join({memberId, name = "Anonymous"}: {memberId: string, name?: string}): Update {
        return {type: "join", memberId: memberId, name: name}
    },
}

export function applyUpdate(meeting: Meeting, update: Update): Meeting {
    if (update.type === "join") {
        return {
            ...meeting,
            members: meeting.members.push({memberId: update.memberId, name: update.name, handSignal: null}),
        };
    } else if (update.type === "setName") {
        return Meetings.updateMemberByMemberId(meeting, update.memberId, member => ({
            ...member,
            name: update.name,
        }));
    } else if (update.type === "setHandSignal") {
        return Meetings.updateMemberByMemberId(meeting, update.memberId, member => ({
            ...member,
            handSignal: update.handSignal,
        }));
    } else {
        return assertUnreachable(update, "unhandled update type: " + (update as Update).type);
    }
}

export type ClientMessage =
    | {type: "setName", name: string}
    | {type: "setHandSignal", handSignal: string | null};

const ClientMessage = t.union([
    t.strict({
        type: t.literal("setName"),
        name: t.string,
    }),
    t.strict({
        type: t.literal("setHandSignal"),
        handSignal: t.union([t.string, t.null]),
    }),
]);

export function clientMessageToUpdate(memberId: string, message: unknown): Update | null {
    return pipe(ClientMessage.decode(message), fold(
        () => null,
        message => ({...message, memberId: memberId}),
    ));
}
