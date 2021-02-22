import cryptoRandomString from "crypto-random-string";
import { List, OrderedMap } from "immutable";

import { Meeting } from "./meetings";
import * as store from "./store";

interface MeetingRepository {
    createMeeting: (options: {hasQueue: boolean}) => Promise<Meeting>;
    get: (meetingCode: string) => Promise<Meeting | undefined>;
    update: (meetingCode: string, f: (meeting: Meeting | undefined) => Meeting) => Promise<void>;
}

export function createMeetingRepository(): MeetingRepository {
    const meetings = store.inMemory<string, Meeting>();
    return newMeetingRepository({
        generateMeetingCode: generateMeetingCode,
        meetings: meetings,
    });
}

export function newMeetingRepository({generateMeetingCode, meetings}: {
    generateMeetingCode: () => string,
    meetings: store.Store<string, Meeting>
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
        const result = await meetings.get(meetingCode);
        return result.value;
    }

    async function update(meetingCode: string, f: (meeting: Meeting | undefined) => Meeting): Promise<void> {
        while (true) {
            const getResult = await meetings.get(meetingCode);
            const newMeeting = f(getResult.value);
            const saveResult = await save(getResult.version, newMeeting);
            if (saveResult === store.SetResult.Success) {
                return;
            }
        }
    }

    async function save(previousVersion: number | null, meeting: Meeting): Promise<store.SetResult> {
        return await meetings.set(meeting.meetingCode, previousVersion, meeting);
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
