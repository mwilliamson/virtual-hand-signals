import assert from "assert";

import { List, OrderedMap } from "immutable";

import * as meetings from "../lib/meetings";

suite(__filename, function () {
    suite("applyUpdate", function () {
        suite("join", function () {
            test("when memberId is not already in members then member is added", function () {
                const meeting = createMeeting({members: OrderedMap()});

                const result = meetings.applyUpdate(meeting, {
                    type: "join",
                    memberId: "1",
                    name: "Bob",
                });

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

                let result = meetings.applyUpdate(meeting, {
                    type: "join",
                    memberId: "2",
                    name: "Bob",
                });
                result = meetings.applyUpdate(result, {
                    type: "join",
                    memberId: "1",
                    name: "Alice",
                });

                assert.deepStrictEqual(result.members.keySeq().toJSON(), ["2", "1"]);
            });
        });
    });
});

function createMeeting(meeting: Partial<meetings.Meeting>): meetings.Meeting {
    return {
        meetingCode: "<meetingCode>",
        members: OrderedMap(),
        queue: List(),
        ...meeting,
    };
}
