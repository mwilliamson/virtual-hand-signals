import cryptoRandomString from "crypto-random-string";
import { OrderedMap } from "immutable";

import { Meeting } from "./meetings";

export function createMeetingRepository() {
    const meetings = new Map<string, Meeting>();

    function createMeeting({hasQueue}: {hasQueue: boolean}): Meeting {
        while (true) {
            const meetingCode = generateMeetingCode();
            if (!meetings.has(meetingCode)) {
                return {
                    meetingCode: meetingCode,
                    members: OrderedMap(),
                    hasQueue: hasQueue,
                };
            }
        }
    }

    function get(meetingCode: string): Meeting | undefined {
        return meetings.get(meetingCode);
    }

    function set(meetingCode: string, meeting: Meeting): void {
        meetings.set(meetingCode, meeting);
    }

    return {
        createMeeting: createMeeting,
        get: get,
        set: set,
    };
}

function generateMeetingCode() {
    const part = () => cryptoRandomString({length: 3, characters: "abcdefghijklmopqrstuvwxyz"});

    return `${part()}-${part()}-${part()}`;
}
