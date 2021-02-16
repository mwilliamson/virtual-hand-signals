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
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    Stack,
 } from "@chakra-ui/react";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import PersonIcon from "@material-ui/icons/Person";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { applyUpdate, ClientMessage, ClientMessages, handSignals, Meeting, Member } from "server/lib/meetings";
import * as api from "./api";
import { JoinMeetingHistoryState, useNavigation } from "./navigation";
import PageContentContainer from "./PageContentContainer";

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
            {state.type === "connected" ? (
                <MeetingPageConnected
                    meeting={state.meeting}
                    memberId={state.memberId}
                    send={message => state.send(message)}
                />
            ) : (
                <AppBar meetingCode={meetingCode} />
            )}
        </>
    );
}

interface MeetingPageConnectedProps {
    meeting: Meeting;
    memberId: string;
    send: (message: ClientMessage) => void;
}

function MeetingPageConnected(props: MeetingPageConnectedProps) {
    const {meeting, memberId, send} = props;

    const member = meeting.members.get(memberId);

    if (member === undefined) {
        const handleJoin = (name: string) => {
            send(ClientMessages.join(name));
        };

        return (
            <MeetingPageJoining meeting={meeting} send={send} />
        );
    } else {
        return (
            <MeetingPageJoined meeting={meeting} member={member} send={send} />
        );
    }
}

interface MeetingPageJoiningProps {
    meeting: Meeting;
    send: (message: ClientMessage) => void;
}

function MeetingPageJoining(props: MeetingPageJoiningProps) {
    // TODO: store previously used name
    const {meeting, send} = props;

    const handleJoin = (name: string) => {
        send(ClientMessages.join(name));
    };

    const location = useLocation();

    const state = location.state as JoinMeetingHistoryState;

    useEffect(() => {
        if (state != null) {
            handleJoin(state.name);
        }
    }, [state]);

    return (
        <>
            <Box position="sticky" top={0}>
                <AppBar meetingCode={meeting.meetingCode} />
            </Box>
            {state == null && (
                <PageContentContainer>
                    <JoinForm onJoin={handleJoin} />
                </PageContentContainer>
            )}
        </>
    );
}

interface MeetingPageJoinedProps {
    meeting: Meeting;
    member: Member;
    send: (message: ClientMessage) => void;
}

function MeetingPageJoined(props: MeetingPageJoinedProps) {
    const {meeting, member, send} = props;

    const [changeName, setChangeName] = useState(false);

    useEffect(() => {
        // Once we've joined the meeting, replace the history state so that
        // reloading the page doesn't automatically fill in the name.
        // We do this now rather than as soon as we send the message to join
        // to avoid briefly rendering the form to enter a name.
        window.history.replaceState(null, "");
    }, []);

    function handleChangeName(newName: string) {
        send(ClientMessages.setName(newName));
        setChangeName(false);
    }

    return (
        <>
            <Box position="sticky" top={0}>
                <AppBar
                    meetingCode={meeting.meetingCode}
                    right={
                        <SettingsMenuButton onChangeName={() => setChangeName(true)} />
                    }
                />
                {!changeName && (
                    <Center>
                        <HandSignalControl
                            onChange={value => send(ClientMessages.setHandSignal(value))}
                            value={member.handSignal ?? null}
                        />
                    </Center>
                )}
            </Box>

            <PageContentContainer>
                {changeName ? (
                    <NameForm
                        initialValue={member.name}
                        onSubmit={handleChangeName}
                        submitText="Change name"
                    />
                ) : (
                    <MembersList meeting={meeting} memberId={member.memberId} />
                )}
            </PageContentContainer>
        </>
    );
}

interface AppBarProps {
    meetingCode: string;
    right?: React.ReactNode;
}

function AppBar(props: AppBarProps) {
    const {meetingCode, right} = props;

    return (
        <Box
            color="white"
            bg="blue.500"
            py={2}
            marginBottom={2}
            fontWeight="bold"
            position="sticky"
            top={0}
            zIndex={100}
        >
            <PageContentContainer>
                <Flex>
                    <Box flex="1 1 auto">
                        Meeting code: {meetingCode}
                    </Box>
                    {right && (
                        <Box>{right}</Box>
                    )}
                </Flex>
            </PageContentContainer>
        </Box>
    );
}

interface SettingsMenuButtonProps {
    onChangeName: () => void;
}

function SettingsMenuButton(props: SettingsMenuButtonProps) {
    const {onChangeName} = props;

    const navigation = useNavigation();

    function handleLeave() {
        navigation.goToHomePage();
    }

    return (
        <Menu placement="bottom-end">
            <MenuButton
                display="block"
                as={IconButton}
                icon={<MoreVertIcon />}
                variant="unstyled"
                size="xs"
                aria-label="Settings"
            />
            <MenuList color="black">
                <MenuItem onClick={() => onChangeName()}>
                    Change name
                </MenuItem>
                <MenuItem onClick={handleLeave}>
                    Leave meeting
                </MenuItem>
            </MenuList>
        </Menu>
    );
}

interface JoinFormProps {
    onJoin: (name: string) => void;
}

function JoinForm(props: JoinFormProps) {
    const {onJoin} = props;

    return (
        <NameForm initialValue="" onSubmit={name => onJoin(name)} submitText="Join" />
    );
}

interface NameFormProps {
    initialValue: string;
    onSubmit: (name: string) => void;
    submitText: string;
}

function NameForm(props: NameFormProps) {
    const {initialValue, onSubmit, submitText} = props;

    const [name, setName] = useState(initialValue);

    const handleJoin = (event: React.SyntheticEvent) => {
        event.preventDefault();
        onSubmit(name);
    };

    return (
        <form onSubmit={handleJoin}>
            <NameControl onChange={name => setName(name)} value={name} />
            <Button disabled={name === ""} mt={4} type="submit">{submitText}</Button>
        </form>
    );
}

interface NameControlProps {
    onChange: (value: string) => void;
    value: string;
}

function NameControl(props: NameControlProps) {
    const {onChange, value} = props;

    return (
        <FormControl>
            <FormLabel>Name</FormLabel>
            <Input autoFocus type="text" onChange={event => onChange(event.target.value)} value={value} />
        </FormControl>
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
                            <PageContentContainer>
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
                            </PageContentContainer>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerOverlay>
            </Drawer>
        </>
    );
}

interface MembersListProps {
    meeting: Meeting;
    memberId: string;
}

function MembersList(props: MembersListProps) {
    const {meeting, memberId} = props;

    return (
        <Stack spacing={2}>
            {meeting.members.valueSeq().map(member => (
                <Flex key={member.memberId}>
                    <Box flex="1">
                        <Box as="span" color="blue.300" mr={2}>
                            <PersonIcon />
                        </Box>

                        {member.name}
                        {member.memberId === memberId && " (you)"}
                    </Box>
                    <div>
                        {member.handSignal !== null && (
                            <Box as="span" bg="gray.100" borderRadius="lg" px={2} py={1} my={-1}>
                                {member.handSignal}
                            </Box>
                        )}
                    </div>
                </Flex>
            ))}
        </Stack>
    );
}
