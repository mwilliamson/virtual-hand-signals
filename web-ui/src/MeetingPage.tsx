import {
    Box,
    Button,
    Center,
    Container,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerOverlay,
    Flex,
    FormControl,
    FormLabel,
    Input,
    Stack,
 } from "@chakra-ui/react";
import PersonIcon from "@material-ui/icons/Person";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { applyUpdate, ClientMessage, ClientMessages, handSignals, Meeting } from "server/lib/meetings";
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
        return (
            <>
                <Center>
                    <HandSignalControl
                        onChange={value => send(ClientMessages.setHandSignal(value))}
                        value={meeting.members.get(memberId)?.handSignal ?? null}
                    />
                </Center>

                <Stack spacing={2}>
                    {meeting.members.valueSeq().map(member => (
                        <div key={member.memberId}>
                            <Box as="span" color="blue.300" mr={2}>
                                <PersonIcon />
                            </Box>

                            {member.name}
                            {member.memberId === memberId && " (you)"}
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
                <Input autoFocus type="text" onChange={event => setName(event.target.value)} value={name} />
            </FormControl>
            <Button disabled={name === ""} mt={4} type="submit">Join</Button>
        </form>
    );
}

interface HandSignalControlProps {
    onChange: (value: string | null) => void;
    value: string | null;
}

function HandSignalControl(props: HandSignalControlProps) {
    const {onChange, value} = props;

    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

    const handleRaiseHandClick = () => {
        setIsDrawerVisible(true);
    };

    const handleSelectHandSignal = (handSignal: string) => {
        onChange(handSignal);
        setIsDrawerVisible(false);
    };

    const handleLowerHandClick = () => {
        onChange(null);
    };
    
    const button = value === null ? (
        <Button my={4} onClick={handleRaiseHandClick}>Raise hand</Button>
    ) : (
        <Button my={4} onClick={handleLowerHandClick}>Lower hand</Button>
    );

    return (
        <>
            {button}
            <Drawer placement="top" isOpen={isDrawerVisible} onClose={() => setIsDrawerVisible(false)}>
                <DrawerOverlay>
                    <DrawerContent>
                        <DrawerBody>
                            <Stack spacing={2}>
                                {handSignals.map(handSignal => (
                                    <Button
                                        key={handSignal}
                                        onClick={() => handleSelectHandSignal(handSignal)}
                                    >
                                        {handSignal}
                                    </Button>
                                ))}
                            </Stack>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerOverlay>
            </Drawer>
        </>
    );
}
