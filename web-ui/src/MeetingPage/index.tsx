import {
    Button,
    Center,
    FormControl,
    FormLabel,
    Input,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { applyUpdate, ClientMessage, ClientMessages, Meeting, Member } from "server/lib/meetings";
import { assertUnreachable } from "server/lib/types";
import * as api from "../api";
import {
    ErrorAlert,
    meetingNotFoundTitle,
    meetingNotFoundDescription,
    UnexpectedErrorAlert,
    useErrorReporter,
} from "../errors";
import * as localStorage from "../localStorage";
import { JoinMeetingHistoryState } from "../navigation";
import Page from "../Page";
import HandSignalControl from "./HandSignalControl";
import MeetingStatus from "./MeetingStatus";
import SettingsMenuItems from "./SettingsMenuItems";

type State =
    | {type: "connecting"}
    | {type: "connected", meeting: Meeting, memberId: string, send: (message: ClientMessage) => void}
    | {type: "error", error: Error}
    | {type: "meetingNotFound"};

export default function MeetingPage() {
    const {meetingCode} = useParams<{meetingCode: string}>();

    const [state, setState] = useState<State>({type: "connecting"});
    const errorReporter = useErrorReporter();

    useEffect(() => {
        const connection = api.joinMeeting({
            meetingCode: meetingCode,
            onFatal: error => {
                setState({type: "error", error: error});
            },
            onError: error => {
                errorReporter.unexpectedError({error: error});
            },
            onNotFound: () => {
                setState({type: "meetingNotFound"});
            },
            onInit: ({meeting, memberId}) => {
                const send = (message: ClientMessage) => {
                    connection.send(message);
                    if (message.type === "v1/join" || message.type === "v1/setName") {
                        localStorage.setName(message.name);
                    }
                };
                setState({type: "connected", meeting: meeting, memberId: memberId, send: send});
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

    if (state.type === "connecting") {
        return (
            <MeetingPageContainer meetingCode={meetingCode} />
        );
    } else if (state.type === "error") {
        return (
            <MeetingPageContainer meetingCode={meetingCode}>
                <UnexpectedErrorAlert error={state.error} />
            </MeetingPageContainer>
        );
    } else if (state.type === "meetingNotFound") {
        return (
            <MeetingPageContainer meetingCode={meetingCode}>
                <ErrorAlert
                    title={meetingNotFoundTitle}
                    description={meetingNotFoundDescription(meetingCode)}
                />
            </MeetingPageContainer>
        );
    } else if (state.type === "connected") {
        return (
            <MeetingPageConnected
                meeting={state.meeting}
                memberId={state.memberId}
                send={message => state.send(message)}
            />
        );
    } else {
        return assertUnreachable(state, `unhandled state type: ${(state as State).type}`);
    }
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
        <MeetingPageContainer meetingCode={meeting.meetingCode}>
            {state == null && (
                <NameForm onSubmit={handleJoin} submitText="Join" />
            )}
        </MeetingPageContainer>
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
        <MeetingPageContainer
            meetingCode={meeting.meetingCode}
            settingsMenuItems={
                <SettingsMenuItems onChangeName={() => setChangeName(true)} send={send} />
            }
            stickyTop={
                !changeName && (
                    <Center>
                        <HandSignalControl
                            onChange={value => send(ClientMessages.setHandSignal(value))}
                            value={member.handSignal ?? null}
                        />
                    </Center>
                )
            }
        >
            {changeName ? (
                <NameForm
                    initialValue={member.name}
                    onSubmit={handleChangeName}
                    submitText="Change name"
                />
            ) : (
                <MeetingStatus meeting={meeting} member={member} />
            )}
        </MeetingPageContainer>
    );
}

interface MeetingPageContainerProps {
    children?: React.ReactNode;
    meetingCode: string;
    settingsMenuItems?: React.ReactNode;
    stickyTop?: React.ReactNode;
}

function MeetingPageContainer(props: MeetingPageContainerProps) {
    const {children, meetingCode, settingsMenuItems, stickyTop} = props;

    return (
        <Page
            title={`Meeting code: ${meetingCode}`}
            settingsMenuItems={settingsMenuItems}
            stickyTop={stickyTop}
        >
            {children}
        </Page>
    );
}

interface NameFormProps {
    initialValue?: string;
    onSubmit: (name: string) => void;
    submitText: string;
}

function NameForm(props: NameFormProps) {
    const {initialValue, onSubmit, submitText} = props;

    const [name, setName] = useState(() => {
        if (initialValue !== undefined) {
            return initialValue;
        } else {
            return localStorage.getName() ?? "";
        }
    });

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
            <FormLabel>Your name</FormLabel>
            <Input autoFocus type="text" onChange={event => onChange(event.target.value)} value={value} />
        </FormControl>
    );
}
