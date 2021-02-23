import cryptoRandomString from "crypto-random-string";
import { isLeft } from "fp-ts/Either";
import { List, OrderedMap } from "immutable";
import * as t from "io-ts";

import { Meeting } from "./meetings";
import * as store from "./store";

export interface MeetingRepository {
    createMeeting: (options: {hasQueue: boolean}) => Promise<Meeting>;
    get: (meetingCode: string) => Promise<Meeting | undefined>;
    update: (meetingCode: string, f: (meeting: Meeting | undefined) => Meeting) => Promise<void>;
}

export async function createMeetingRepository({meetingStore}: {
    meetingStore: MeetingStore,
}): Promise<MeetingRepository> {
    return newMeetingRepository({
        generateMeetingCode: generateMeetingCode,
        meetings: meetingStore,
    });
}

export type MeetingStore = store.Store<string, t.OutputOf<typeof Meeting>>;

export function newMeetingRepository({generateMeetingCode, meetings}: {
    generateMeetingCode: () => string,
    meetings: MeetingStore,
}) {
    async function createMeeting({hasQueue}: {hasQueue: boolean}): Promise<Meeting> {
        while (true) {
            const meetingCode = generateMeetingCode();
            const getResult = await meetings.get(meetingCode);
            if (getResult.value === undefined) {
                const meeting: Meeting = {
                    meetingCode: meetingCode,
                    members: OrderedMap(),
                    queue: hasQueue ? List() : null,
                };
                const saveResult = await save(null, meeting);
                if (saveResult === store.SetResult.Success) {
                    return meeting;
                }
            }
        }
    }

    async function get(meetingCode: string): Promise<Meeting | undefined> {
        const getResult = await meetings.get(meetingCode);
        return decodeStoreValue(getResult.value);
    }

    function decodeStoreValue(value: undefined | t.OutputOf<typeof Meeting>): Meeting | undefined {
        if (value === undefined) {
            return undefined;
        } else {
            const decodeResult = Meeting.decode(value);
            if (isLeft(decodeResult)) {
                throw new Error("could not decode value from store");
            } else {
                return decodeResult.right;
            }
        }
    }

    async function update(meetingCode: string, f: (meeting: Meeting | undefined) => Meeting): Promise<void> {
        while (true) {
            const getResult = await meetings.get(meetingCode);
            const newMeeting = f(decodeStoreValue(getResult.value));
            const saveResult = await save(getResult.version, newMeeting);
            if (saveResult === store.SetResult.Success) {
                return;
            }
        }
    }

    async function save(previousVersion: number | null, meeting: Meeting): Promise<store.SetResult> {
        return await meetings.set(
            meeting.meetingCode,
            previousVersion,
            Meeting.encode(meeting),
        );
    }

    return {
        createMeeting: createMeeting,
        get: get,
        update: update,
    };
}

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}
