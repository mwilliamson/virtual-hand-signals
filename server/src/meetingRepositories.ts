import cryptoRandomString from "crypto-random-string";
import { List, OrderedMap } from "immutable";

import { Meeting } from "./meetings";

export function createMeetingRepository() {
    const meetings = new Map<string, Meeting>();

    function createMeeting({hasQueue}: {hasQueue: boolean}): Meeting {
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

    function get(meetingCode: string): Meeting | undefined {
        return meetings.get(meetingCode);
    }

    function update(meetingCode: string, f: (meeting: Meeting | undefined) => Meeting): void {
        const newMeeting = f(get(meetingCode));
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
