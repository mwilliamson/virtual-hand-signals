import assert from "assert";

import * as td from "testdouble";

import * as store from "../lib/store";
import * as meetingRepositories from "../lib/meetingRepositories";
import { MeetingDetails } from "../lib/meetings";

suite(__filename, function () {
    test("when store does not have meeting with code then get() returns undefined", async function() {
        const meetingStore = fakeStore();
        td.when(meetingStore.get("abc")).thenResolve({value: undefined, version: null});
        const meetingRepository = meetingRepositories.newMeetingRepository({
            meetings: meetingStore,
            generateMeetingCode: () => "<meeting code>",
        });

        const meeting = await meetingRepository.get("abc");

        assert.strictEqual(meeting, undefined);
    });

    test("when store does have meeting with code then get() returns meeting", async function() {
        const meetingStore = fakeStore();
        td.when(meetingStore.get("abc")).thenResolve({
            value: createMeeting({meetingCode: "abc"}),
            version: 1,
        });
        const meetingRepository = meetingRepositories.newMeetingRepository({
            meetings: meetingStore,
            generateMeetingCode: () => "<meeting code>",
        });

        const meeting = await meetingRepository.get("abc");

        assert.strictEqual(meeting?.meetingCode, "abc");
    });

    test("createMeeting() generates new codes until unused code is generated", async function() {
        const meetingStore = fakeStore();
        td.when(meetingStore.get("1")).thenResolve({value: createMeeting(), version: 1});
        td.when(meetingStore.get("2")).thenResolve({value: undefined, version: null});
        td.when(meetingStore.set("2", null, td.matchers.anything())).thenResolve(store.SetResult.Success);
        let nextMeetingCode = 1;
        const meetingRepository = meetingRepositories.newMeetingRepository({
            meetings: meetingStore,
            generateMeetingCode: () => (nextMeetingCode++).toString(),
        });

        const meeting = await meetingRepository.createMeeting({hasQueue: false});

        assert.strictEqual(meeting.meetingCode, "2");
    });

    test("createMeeting() generates new code if code is used between get and set", async function() {
        const meetingStore = fakeStore();
        td.when(meetingStore.get("1")).thenResolve({value: undefined, version: null});
        td.when(meetingStore.set("1", null, td.matchers.anything())).thenResolve(store.SetResult.Stale);
        td.when(meetingStore.get("2")).thenResolve({value: undefined, version: null});
        td.when(meetingStore.set("2", null, td.matchers.anything())).thenResolve(store.SetResult.Success);
        let nextMeetingCode = 1;
        const meetingRepository = meetingRepositories.newMeetingRepository({
            meetings: meetingStore,
            generateMeetingCode: () => (nextMeetingCode++).toString(),
        });

        const meeting = await meetingRepository.createMeeting({hasQueue: false});

        assert.strictEqual(meeting.meetingCode, "2");
    });

    test("update() retries until successful set() on store", async function() {
        const meetingStore = fakeStore();
        td.when(meetingStore.get("<meeting code>")).thenResolve(
            {value: createMeeting({meetingCode: "<meeting code>", hasQueue: false}), version: 1},
            {value: createMeeting({meetingCode: "<meeting code>", hasQueue: false}), version: 2},
            {value: createMeeting({meetingCode: "<meeting code>", hasQueue: false}), version: 3},
        );
        td.when(meetingStore.set("<meeting code>", 1, td.matchers.anything()))
            .thenResolve(store.SetResult.Stale);
        td.when(meetingStore.set("<meeting code>", 2, td.matchers.anything()))
            .thenResolve(store.SetResult.Stale);
        td.when(meetingStore.set("<meeting code>", 3, td.matchers.anything()))
            .thenResolve(store.SetResult.Success);
        const meetingRepository = meetingRepositories.newMeetingRepository({
            meetings: meetingStore,
            generateMeetingCode: () => { throw new Error() },
        });

        await meetingRepository.update(
            "<meeting code>",
            meeting => ({...meeting!!, hasQueue: true}),
        );

        td.verify(meetingStore.set(
            "<meeting code>",
            3,
            td.matchers.contains({hasQueue: true}),
        ));
    });
});

function fakeStore() {
    return td.object<meetingRepositories.MeetingStore>();
}

function createMeeting(meeting: Partial<MeetingDetails> = {}) {
    const fullMeeting: MeetingDetails = {
        meetingCode: "<meeting code>",
        hasQueue: false,
        ...meeting,
    };
    return MeetingDetails.encode(fullMeeting);
}
