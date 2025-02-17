import assert from "assert";

import { List, OrderedMap } from "immutable";

import { applyUpdate, Meeting, Meetings, Updates } from "../lib/meetings";

suite(__filename, function () {
    suite("applyUpdate", function () {
        suite("join", function () {
            test("when memberId is not already in members then member is added", function () {
                const meeting = createMeeting({members: OrderedMap()});

                const result = applyUpdate(meeting, Updates.join({memberId: "1", name: "Bob"}));

                assert.deepStrictEqual(result.members.entrySeq().toJSON(), [
                    ["1", {
                        handSignal: null,
                        memberId: "1",
                        name: "Bob",
                    }],
                ]);
            });

            test("members preserves join order", function () {
                const meeting = createMeeting({members: OrderedMap()});

                let result = applyUpdate(meeting, Updates.join({memberId: "2", name: "Bob"}));
                result = applyUpdate(result, Updates.join({memberId: "1", name: "Alice"}));

                assert.deepStrictEqual(result.members.keySeq().toJSON(), ["2", "1"]);
            });

            test("when memberId is already in members then name is updated without changing order", function () {
                const meeting = createMeeting({members: OrderedMap()});

                let result = applyUpdate(meeting, Updates.join({memberId: "2", name: "Bob"}));
                result = applyUpdate(result, Updates.join({memberId: "1", name: "Alice"}));
                result = applyUpdate(result, Updates.setHandSignal({memberId: "2", handSignal: "agree"}));
                result = applyUpdate(result, Updates.join({memberId: "2", name: "Robert"}));

                assert.deepStrictEqual(result.members.entrySeq().toJSON(), [
                    ["2", {
                        handSignal: "agree",
                        memberId: "2",
                        name: "Robert",
                    }],
                    ["1", {
                        handSignal: null,
                        memberId: "1",
                        name: "Alice",
                    }],
                ]);
            });
        });

        suite("leave", function () {
            test("when memberId is not in meeting then leaving does nothing", function () {
                const meeting = createMeeting({members: OrderedMap()});

                const result = applyUpdate(meeting, Updates.leave({memberId: "1"}));

                assert.deepStrictEqual(result.members.entrySeq().toJSON(), []);
            });

            test("when memberId is in meeting then leaving removes member", function () {
                const meeting = createMeeting({members: OrderedMap()});

                let result = applyUpdate(meeting, Updates.join({memberId: "1", name: "Alice"}));
                result = applyUpdate(result, Updates.join({memberId: "2", name: "Bob"}));
                result = applyUpdate(result, Updates.leave({memberId: "1"}));

                assert.deepStrictEqual(result.members.keySeq().toJSON(), ["2"]);
            });

            test("when memberId is in queue then leaving removes member", function () {
                const meeting = createEmptyMeetingWithQueue();

                let result = applyUpdate(meeting, Updates.join({memberId: "1", name: "Alice"}));
                result = applyUpdate(result, Updates.join({memberId: "2", name: "Bob"}));
                result = applyUpdate(result, Updates.setHandSignal({memberId: "1", handSignal: "clarification"}));
                result = applyUpdate(result, Updates.setHandSignal({memberId: "2", handSignal: "clarification"}));
                result = applyUpdate(result, Updates.leave({memberId: "1"}));

                assert.deepStrictEqual(Meetings.getQueue(result)!!.toJSON(), ["2"]);
            });
        });
    });

    suite("setHandSignal", function () {
        test("when queue is empty then raising hand puts member to front of queue", function () {
            let meeting = createMeetingWithMemberIds(["A", "B"]);
            meeting = addMember(meeting, "A");
            meeting = addMember(meeting, "B");

            const result = applyUpdate(meeting, Updates.setHandSignal({memberId: "A", handSignal: "direct response"}));

            assert.deepStrictEqual(Meetings.getQueue(result)!!.toJSON(), ["A"]);
        });

        test("when queue contains hand signal then raising same hand signal adds member to back of queue", function () {
            let meeting = createMeetingWithMemberIds(["A", "B"]);
            meeting = addMember(meeting, "A");
            meeting = addMember(meeting, "B");
            meeting = applyUpdate(meeting, Updates.setHandSignal({memberId: "B", handSignal: "direct response"}));

            const result = applyUpdate(meeting, Updates.setHandSignal({memberId: "A", handSignal: "direct response"}));

            assert.deepStrictEqual(Meetings.getQueue(result)!!.toJSON(), ["B", "A"]);
        });

        test("when queue contains hand signal then raising hand signal with lower precedence adds member to back of queue", function () {
            let meeting = createMeetingWithMemberIds(["A", "B"]);
            meeting = addMember(meeting, "A");
            meeting = addMember(meeting, "B");
            meeting = applyUpdate(meeting, Updates.setHandSignal({memberId: "B", handSignal: "clarification"}));

            const result = applyUpdate(meeting, Updates.setHandSignal({memberId: "A", handSignal: "direct response"}));

            assert.deepStrictEqual(Meetings.getQueue(result)!!.toJSON(), ["B", "A"]);
        });

        test("when queue contains hand signal then raising hand signal with higher precedence adds member to front of queue", function () {
            let meeting = createMeetingWithMemberIds(["A", "B"]);
            meeting = addMember(meeting, "A");
            meeting = addMember(meeting, "B");
            meeting = applyUpdate(meeting, Updates.setHandSignal({memberId: "B", handSignal: "direct response"}));

            const result = applyUpdate(meeting, Updates.setHandSignal({memberId: "A", handSignal: "clarification"}));

            assert.deepStrictEqual(Meetings.getQueue(result)!!.toJSON(), ["A", "B"]);
        });
    });
});

function createMeetingWithMemberIds(memberIds: Array<string>): Meeting {
    let meeting = createEmptyMeetingWithQueue();

    for (const memberId of memberIds) {
        meeting = addMember(meeting, memberId);
    }

    return meeting;
}

function createEmptyMeetingWithQueue(): Meeting {
    return createMeeting({members: OrderedMap(), handRaiseOrder: List(), hasQueue: true});
}

function addMember(meeting: Meeting, memberId: string): Meeting {
    return applyUpdate(meeting, Updates.join({memberId: memberId, name: `Name of ${memberId}`}));
}

function createMeeting(meeting: Partial<Meeting>): Meeting {
    return {
        meetingCode: "<meetingCode>",
        members: OrderedMap(),
        handRaiseOrder: List(),
        hasQueue: true,
        ...meeting,
    };
}
