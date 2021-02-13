import cryptoRandomString from "crypto-random-string";
import { pipe } from "fp-ts/function";
import { fold } from "fp-ts/Either";
import { OrderedMap, updateIn } from "immutable";
import * as t from "io-ts";

import * as immutableT from "./immutable-io-ts";
import {assertUnreachable} from "./types";

export interface Member {
    memberId: string;
    name: string;
    handSignal: string | null;
}

const Member = t.strict({
    memberId: t.string,
    name: t.string,
    handSignal: t.union([t.string, t.null]),
});

export interface Meeting {
    meetingCode: string;
    members: OrderedMap<string, Member>;
}

const Meeting = t.strict({
    meetingCode: t.string,
    members: immutableT.orderedMap(t.string, Member),
});

const Meetings = {
    updateMemberByMemberId(meeting: Meeting, memberId: string, update: (member: Member) => Member): Meeting {
        const member = meeting.members.get(memberId);
        if (member === undefined) {
            throw new Error("no member with memberId: " + memberId);
        }
        
        return updateIn(meeting, ["members", memberId], update);
    },
};

export const handSignals = [
    "agree",
    "disagree",
    "want to talk",
    "direct response",
    "clarification",
    "point of order",
];

export function createMeeting(): Meeting {
    const meetingCode = generateMeetingCode();
    return {meetingCode: meetingCode, members: OrderedMap()};
}

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}

export type Update =
    | {type: "join", memberId: string, name: string}
    | {type: "leave", memberId: string}
    | {type: "setName", memberId: string, name: string}
    | {type: "setHandSignal", memberId: string, handSignal: string | null};

export const Update = t.union([
    t.strict({
        type: t.literal("join"),
        memberId: t.string,
        name: t.string,
    }),
    t.strict({
        type: t.literal("leave"),
        memberId: t.string,
    }),
    t.strict({
        type: t.literal("setName"),
        memberId: t.string,
        name: t.string,
    }),
    t.strict({
        type: t.literal("setHandSignal"),
        memberId: t.string,
        handSignal: t.union([t.string, t.null]),
    }),
]);

export type ServerMessage =
    | Update
    | {type: "initial", memberId: string, meeting: Meeting}
    | {type: "invalid", message: unknown};

export const ServerMessage = t.union([
    Update,
    t.strict({
        type: t.literal("initial"),
        memberId: t.string,
        meeting: Meeting,
    }),
    t.strict({
        type: t.literal("invalid"),
        message: t.unknown,
    }),
]);

export const ServerMessages = {
    toJson(message: ServerMessage) {
        return ServerMessage.encode(message);
    },

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

    leave({memberId}: {memberId: string}): Update {
        return {type: "leave", memberId: memberId};
    },
}

export function applyUpdate(meeting: Meeting, update: Update): Meeting {
    if (update.type === "join") {
        // TODO: handle multiple joins
        return {
            ...meeting,
            members: meeting.members.set(
                update.memberId,
                {memberId: update.memberId, name: update.name, handSignal: null},
            ),
        };
    } else if (update.type === "leave") {
        return {
            ...meeting,
            members: meeting.members.delete(update.memberId),
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
