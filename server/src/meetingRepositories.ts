import cryptoRandomString from "crypto-random-string";
import { isLeft } from "fp-ts/Either";
import * as t from "io-ts";

import { MeetingDetails, MeetingSettings } from "./meetings";
import * as store from "./store";

export interface MeetingRepository {
    createMeeting: (settings: MeetingSettings) => Promise<MeetingDetails>;
    get: (meetingCode: string) => Promise<MeetingDetails | undefined>;
    update: (meetingCode: string, f: (meeting: MeetingDetails | undefined) => MeetingDetails) => Promise<void>;
}

export async function createMeetingRepository({meetingStore}: {
    meetingStore: MeetingStore,
}): Promise<MeetingRepository> {
    return newMeetingRepository({
        generateMeetingCode: generateMeetingCode,
        meetings: meetingStore,
    });
}

export type MeetingStore = store.Store<string, MeetingDetails>;

export function newMeetingRepository({generateMeetingCode, meetings}: {
    generateMeetingCode: () => string,
    meetings: MeetingStore,
}) {
    async function createMeeting(settings: MeetingSettings): Promise<MeetingDetails> {
        while (true) {
            const meetingCode = generateMeetingCode();
            const details = {...settings, meetingCode: meetingCode};
            const saveResult = await save(null, details);
            if (saveResult === store.SetResult.Success) {
                return details;
            }
        }
    }

    async function get(meetingCode: string): Promise<MeetingDetails | undefined> {
        const getResult = await meetings.get(meetingCode);
        return decodeStoreValue(getResult.value);
    }

    function decodeStoreValue(value: undefined | t.OutputOf<typeof MeetingDetails>): MeetingDetails | undefined {
        if (value === undefined) {
            return undefined;
        } else {
            const decodeResult = MeetingDetails.decode(value);
            if (isLeft(decodeResult)) {
                throw new Error("could not decode value from store");
            } else {
                return decodeResult.right;
            }
        }
    }

    async function update(
        meetingCode: string,
        f: (meetingDetails: MeetingDetails | undefined) => MeetingDetails,
    ): Promise<void> {
        while (true) {
            const getResult = await meetings.get(meetingCode);
            const newMeeting = f(decodeStoreValue(getResult.value));
            const saveResult = await save(getResult.version, newMeeting);
            if (saveResult === store.SetResult.Success) {
                return;
            }
        }
    }

    async function save(previousVersion: number | null, meetingDetails: MeetingDetails): Promise<store.SetResult> {
        return await meetings.set(
            meetingDetails.meetingCode,
            previousVersion,
            MeetingDetails.encode(meetingDetails),
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
