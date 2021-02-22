import cryptoRandomString from "crypto-random-string";
import { List, OrderedMap } from "immutable";

import { Meeting } from "./meetings";

interface MeetingRepository {
    createMeeting: (options: {hasQueue: boolean}) => Promise<Meeting>;
    get: (meetingCode: string) => Promise<Meeting | undefined>;
    update: (meetingCode: string, f: (meeting: Meeting | undefined) => Meeting) => Promise<void>;
}

export function createMeetingRepository(): MeetingRepository {
    const meetings = new Map<string, Meeting>();

    async function createMeeting({hasQueue}: {hasQueue: boolean}): Promise<Meeting> {
        while (true) {
            const meetingCode = generateMeetingCode();
            if (!meetings.has(meetingCode)) {
                const meeting: Meeting = {
                    meetingCode: meetingCode,
                    members: OrderedMap(),
                    queue: hasQueue ? List() : null,
                };
                save(meeting);
                return meeting;
            }
        }
    }

    async function get(meetingCode: string): Promise<Meeting | undefined> {
        return meetings.get(meetingCode);
    }

    async function update(meetingCode: string, f: (meeting: Meeting | undefined) => Meeting): Promise<void> {
        const newMeeting = f(await get(meetingCode));
        save(newMeeting);
    }

    function save(meeting: Meeting) {
        meetings.set(meeting.meetingCode, meeting);
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
