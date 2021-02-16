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
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Stack,
 } from "@chakra-ui/react";
import MoreVertIcon from "@material-ui/icons/MoreVert";
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
            {state.type === "connected" ? (
                <ConnectedMeeting
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

interface ConnectedMeetingProps {
    meeting: Meeting;
    memberId: string;
    send: (message: ClientMessage) => void;
}

function ConnectedMeeting(props: ConnectedMeetingProps) {
    const {meeting, memberId, send} = props;

    const member = meeting.members.get(memberId);

    if (member === undefined) {
        const handleJoin = (name: string) => {
            send(ClientMessages.join(name));
        };

        return (
            <>
                <Box position="sticky" top={0}>
                    <AppBar meetingCode={meeting.meetingCode} />
                </Box>
                <PageContent>
                    <JoinForm onJoin={handleJoin} />
                </PageContent>
            </>
        );
    } else {
        return (
            <>
                <Box position="sticky" top={0}>
                    <AppBar
                        meetingCode={meeting.meetingCode}
                        right={
                            <SettingsMenuButton name={member.name} send={send} />
                        }
                    />
                    <Center>
                        <HandSignalControl
                            onChange={value => send(ClientMessages.setHandSignal(value))}
                            value={meeting.members.get(memberId)?.handSignal ?? null}
                        />
                    </Center>
                </Box>

                <PageContent>
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
                </PageContent>
            </>
        );
    }
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
            <PageContent>
                <Flex>
                    <Box flex="1 1 auto">
                        Meeting code: {meetingCode}
                    </Box>
                    {right && (
                        <Box>{right}</Box>
                    )}
                </Flex>
            </PageContent>
        </Box>
    );
}

interface SettingsMenuButtonProps {
    name: string;
    send: (message: ClientMessage) => void;
}

function SettingsMenuButton(props: SettingsMenuButtonProps) {
    const {name, send} = props;

    const [changeName, setChangeName] = useState(false);

    function handleChangeName(newName: string) {
        send(ClientMessages.setName(newName));
        setChangeName(false);
    }

    return (
        <>
            <Modal isOpen={changeName} onClose={() => setChangeName(false)}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Change name</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <NameForm
                            initialValue={name}
                            onSubmit={handleChangeName}
                            submitText="Change name"
                        />
                    </ModalBody>
                </ModalContent>
            </Modal>
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
                    <MenuItem onClick={() => setChangeName(true)}>
                        Change name
                    </MenuItem>
                </MenuList>
            </Menu>
        </>
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
                            <PageContent>
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
                            </PageContent>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerOverlay>
            </Drawer>
        </>
    );
}

interface PageContentProps {
    children: React.ReactNode;
}

function PageContent(props: PageContentProps) {
    const {children} = props;

    return (
        <Container maxWidth="sm">
            {children}
        </Container>
    );
}
