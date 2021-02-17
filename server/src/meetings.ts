import { pipe } from "fp-ts/function";
import { fold } from "fp-ts/Either";
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
    queue: null | List<string>;
}

export const Meeting = t.strict({
    meetingCode: t.string,
    members: immutableT.orderedMap(t.string, Member),
    queue: t.union([
        t.null,
        immutableT.list(t.string),
    ]),
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
    | {type: "invalid", message: unknown}
    | {type: "notFound"};

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
    t.strict({
        type: t.literal("notFound"),
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

    notFound: {type: "notFound" as "notFound"},

    join({memberId, name}: {memberId: string, name: string}): Update {
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
        const meeting2 = Meetings.updateMemberByMemberId(meeting, update.memberId, member => ({
            ...member,
            handSignal: update.handSignal,
        }));

        if (meeting2.queue === null) {
            return meeting;
        } else if (update.handSignal === null) {
            return {
                ...meeting2,
                queue: meeting2.queue.filter(memberId => update.memberId !== memberId),
            };
        } else if (!meeting2.queue.includes(update.memberId))  {
            return {
                ...meeting2,
                queue: meeting2.queue.push(update.memberId),
            };
        } else {
            return meeting;
        }
    } else {
        return assertUnreachable(update, "unhandled update type: " + (update as Update).type);
    }
}

export type ClientMessage =
    | {type: "join", name: string}
    | {type: "setName", name: string}
    | {type: "setHandSignal", handSignal: string | null};

const ClientMessage = t.union([
    t.strict({
        type: t.literal("join"),
        name: t.string,
    }),
    t.strict({
        type: t.literal("setName"),
        name: t.string,
    }),
    t.strict({
        type: t.literal("setHandSignal"),
        handSignal: t.union([t.string, t.null]),
    }),
]);

export const ClientMessages = {
    toJson(message: ClientMessage) {
        return ClientMessage.encode(message);
    },

    join(name: string): ClientMessage {
        return {type: "join", name: name};
    },

    setName(name: string): ClientMessage {
        return {type: "setName", name: name};
    },

    setHandSignal(handSignal: string | null): ClientMessage {
        return {type: "setHandSignal", handSignal: handSignal};
    },
};

export function clientMessageToUpdate(memberId: string, message: unknown): Update | null {
    return pipe(ClientMessage.decode(message), fold(
        () => null,
        message => ({...message, memberId: memberId}),
    ));
}
