import { List, OrderedMap, updateIn } from "immutable";
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
    hasQueue: boolean,
    handRaiseOrder: List<string>;
}

export const Meeting = t.strict({
    meetingCode: t.string,
    members: immutableT.orderedMap(t.string, Member),
    hasQueue: t.boolean,
    handRaiseOrder: immutableT.list(t.string),
});

export const Meetings = {
    create({meetingCode, hasQueue}: {meetingCode: string, hasQueue: boolean}): Meeting {
        return {
            meetingCode: meetingCode,
            members: OrderedMap(),
            hasQueue: hasQueue,
            handRaiseOrder: List(),
        };
    },

    getQueue(meeting: Meeting): List<string> | null {
        return meeting.hasQueue ? meeting.handRaiseOrder : null;
    },

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

export type Update =
    | {type: "v1/join", memberId: string, name: string}
    | {type: "v1/leave", memberId: string}
    | {type: "v1/setName", memberId: string, name: string}
    | {type: "v1/setHandSignal", memberId: string, handSignal: string | null};

export const Update = t.union([
    t.strict({
        type: t.literal("v1/join"),
        memberId: t.string,
        name: t.string,
    }),
    t.strict({
        type: t.literal("v1/leave"),
        memberId: t.string,
    }),
    t.strict({
        type: t.literal("v1/setName"),
        memberId: t.string,
        name: t.string,
    }),
    t.strict({
        type: t.literal("v1/setHandSignal"),
        memberId: t.string,
        handSignal: t.union([t.string, t.null]),
    }),
]);

export type ServerMessage =
    | Update
    | {type: "v1/initial", sessionId: string, memberId: string, meeting: Meeting}
    | {type: "v1/invalid", message: unknown}
    | {type: "v1/notFound"};

export const ServerMessage = t.union([
    Update,
    t.strict({
        type: t.literal("v1/initial"),
        sessionId: t.string,
        memberId: t.string,
        meeting: Meeting,
    }),
    t.strict({
        type: t.literal("v1/invalid"),
        message: t.unknown,
    }),
    t.strict({
        type: t.literal("v1/notFound"),
    }),
]);

export const Updates = {
    notFound: {type: "v1/notFound" as "v1/notFound"},

    join({memberId, name}: {memberId: string, name: string}): Update {
        return {type: "v1/join", memberId: memberId, name: name};
    },

    leave({memberId}: {memberId: string}): Update {
        return {type: "v1/leave", memberId: memberId};
    },

    setHandSignal({memberId, handSignal}: {memberId: string, handSignal: string}): Update {
        return {type: "v1/setHandSignal", memberId: memberId, handSignal: handSignal};
    },
};

export const ServerMessages = {
    ...Updates,

    toJson(message: ServerMessage) {
        return ServerMessage.encode(message);
    },

    initial({meeting, memberId, sessionId}: {meeting: Meeting, memberId: string, sessionId: string}): ServerMessage {
        return {
            type: "v1/initial",
            meeting: meeting,
            memberId: memberId,
            sessionId: sessionId,
        };
    },

    invalid(message: unknown): ServerMessage {
        return {type: "v1/invalid", message: message};
    },
}

export function applyUpdate(meeting: Meeting, update: Update): Meeting {
    if (update.type === "v1/join") {
        if (meeting.members.has(update.memberId)) {
            return Meetings.updateMemberByMemberId(meeting, update.memberId, member => ({
                ...member,
                name: update.name,
            }));
        } else {
            return {
                ...meeting,
                members: meeting.members.set(
                    update.memberId,
                    {memberId: update.memberId, name: update.name, handSignal: null},
                ),
            };
        }
    } else if (update.type === "v1/leave") {
        return {
            ...meeting,
            members: meeting.members.delete(update.memberId),
            handRaiseOrder: meeting.handRaiseOrder.filter(memberId => memberId !== update.memberId),
        };
    } else if (update.type === "v1/setName") {
        return Meetings.updateMemberByMemberId(meeting, update.memberId, member => ({
            ...member,
            name: update.name,
        }));
    } else if (update.type === "v1/setHandSignal") {
        meeting = Meetings.updateMemberByMemberId(meeting, update.memberId, member => ({
            ...member,
            handSignal: update.handSignal,
        }));

        if (update.handSignal === null) {
            return {
                ...meeting,
                handRaiseOrder: meeting.handRaiseOrder.filter(memberId => update.memberId !== memberId),
            };
        } else if (!meeting.handRaiseOrder.includes(update.memberId))  {
            return {
                ...meeting,
                handRaiseOrder: meeting.handRaiseOrder.push(update.memberId),
            };
        } else {
            return meeting;
        }
    } else {
        return assertUnreachable(update, "unhandled update type: " + (update as Update).type);
    }
}

export type ClientUpdate =
    | {type: "v1/join", name: string}
    | {type: "v1/leave"}
    | {type: "v1/setName", name: string}
    | {type: "v1/setHandSignal", handSignal: string | null};

const ClientUpdate = t.union([
    t.strict({
        type: t.literal("v1/join"),
        name: t.string,
    }),
    t.strict({
        type: t.literal("v1/leave"),
    }),
    t.strict({
        type: t.literal("v1/setName"),
        name: t.string,
    }),
    t.strict({
        type: t.literal("v1/setHandSignal"),
        handSignal: t.union([t.string, t.null]),
    }),
]);

export type ClientMessage =
    | ClientUpdate
    | {type: "v1/rejoin", sessionId: string};

export const ClientMessage = t.union([
    ClientUpdate,
    t.strict({
        type: t.literal("v1/rejoin"),
        sessionId: t.string,
    }),
]);

export const ClientMessages = {
    toJson(message: ClientMessage) {
        return ClientMessage.encode(message);
    },

    join({name}: {name: string}): ClientMessage {
        return {type: "v1/join", name: name};
    },

    rejoin({sessionId}: {sessionId: string}): ClientMessage {
        return {type: "v1/rejoin", sessionId: sessionId};
    },

    leave(): ClientMessage {
        return {type: "v1/leave"};
    },

    setName(name: string): ClientMessage {
        return {type: "v1/setName", name: name};
    },

    setHandSignal(handSignal: string | null): ClientMessage {
        return {type: "v1/setHandSignal", handSignal: handSignal};
    },
};

export function clientUpdateToUpdate(memberId: string, update: ClientUpdate): Update {
    return {...update, memberId: memberId};
}
