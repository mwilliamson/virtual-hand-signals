import { Button, Center, Flex, Stack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { applyUpdate, Meeting } from "server/lib/meetings";
import * as api from "./api";

type State =
    | {type: "connecting"}
    | {type: "connected", meeting: Meeting}
    | {type: "error", error: Error};

export default function MeetingPage() {
    const {meetingCode} = useParams<{meetingCode: string}>();

    const [state, setState] = useState<State>({type: "connecting"});

    useEffect(() => {
        api.joinMeeting({
            meetingCode: meetingCode,
            onError: error => {
                setState({type: "error", error: error});
            },
            onInit: meeting => {
                setState({type: "connected", meeting: meeting});
            },
            onUpdate: update => {
                setState(state => {
                    if (state.type === "connected") {
                        const newMeeting = applyUpdate(state.meeting, update);
                        return {...state, meeting: newMeeting};
                    } else {
                        return state;
                    }
                });
            },
        });
    }, []);
    
    return (
        <>
            <Flex
                color="white"
                bg="blue.500"
                padding={2}
                marginBottom={2}
                fontWeight="bold"
            >
                Meeting code: {meetingCode}
            </Flex>
            {state.type === "connected" && (
                <>
                    <Center>
                        <Button>Raise hand</Button>
                    </Center>

                    <Stack spacing={2}>
                        {state.meeting.members.map(member => (
                            <div>
                                {member.name}
                            </div>
                        ))}
                    </Stack>
                </>
            )}
        </>
    );
}
