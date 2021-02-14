import { Button, Center, Container, Flex, FormControl, FormLabel, Input, Stack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { applyUpdate, ClientMessage, ClientMessages, Meeting } from "server/lib/meetings";
import * as api from "./api";

type State =
    | {type: "connecting"}
    | {type: "connected", meeting: Meeting, memberId: string, send: (message: ClientMessage) => void}
    | {type: "error", error: Error};

export default function MeetingPage() {
    const {meetingCode} = useParams<{meetingCode: string}>();

    const [state, setState] = useState<State>({type: "connecting"});

    useEffect(() => {
        const connection = api.joinMeeting({
            meetingCode: meetingCode,
            onError: error => {
                setState({type: "error", error: error});
            },
            onInit: ({meeting, memberId}) => {
                setState({type: "connected", meeting: meeting, memberId: memberId, send: connection.send});
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

        return () => {
            connection.close();
        };
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
                <Container maxWidth="sm">
                    Meeting code: {meetingCode}
                </Container>
            </Flex>
            {state.type === "connected" && (
                <Container maxWidth="sm">
                    <ConnectedMeeting
                        meeting={state.meeting}
                        memberId={state.memberId}
                        send={message => state.send(message)}
                    />
                </Container>
            )}
        </>
    );
}

interface ConnectedMeetingProps {
    meeting: Meeting;
    memberId: string;
    send: (message: ClientMessage) => void;
}

function ConnectedMeeting(props: ConnectedMeetingProps) {
    const {meeting, memberId, send} = props;

    if (!meeting.members.has(memberId)) {
        const handleJoin = (name: string) => {
            send(ClientMessages.join(name));
        };
    
        return (
            <JoinForm onJoin={handleJoin} />
        );
    } else {
        const isHandRaised = meeting.members.get(memberId)?.handSignal != null;
    
        const handleRaiseHand = () => {
            send(ClientMessages.setHandSignal("want to talk"));
        };

        const handleLowerHand = () => {
            send(ClientMessages.setHandSignal(null));
        };
    
        return (
            <>
                <Center>
                    {isHandRaised ? (
                        <Button onClick={handleLowerHand}>Lower hand</Button>
                    ) : (
                        <Button onClick={handleRaiseHand}>Raise hand</Button>
                    )}
                </Center>

                <Stack spacing={2}>
                    {meeting.members.valueSeq().map(member => (
                        <div key={member.memberId}>
                            {member.name}
                            {member.handSignal !== null && (
                                <>
                                    : {member.handSignal}
                                </>
                            )}
                        </div>
                    ))}
                </Stack>
            </>
        );
    }
}

interface JoinFormProps {
    onJoin: (name: string) => void;
}

function JoinForm(props: JoinFormProps) {
    const {onJoin} = props;

    const [name, setName] = useState("");

    const handleJoin = (event: React.SyntheticEvent) => {
        event.preventDefault();
        onJoin(name);
    };
    
    return (
        <form onSubmit={handleJoin}>
            <FormControl>
                <FormLabel>Name</FormLabel>
                <Input type="text" onChange={event => setName(event.target.value)} value={name} />
            </FormControl>
            <Button disabled={name === ""} mt={4} type="submit">Join</Button>
        </form>
    );
}
