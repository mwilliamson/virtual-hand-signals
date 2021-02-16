import {
    Button,
    ButtonGroup,
    Center,
    FormControl,
    FormLabel,
    Input,
 } from "@chakra-ui/react";
import { useState } from "react";

import { Meeting } from "../../server/lib/meetings";
import * as api from "./api";
import { useErrorReporter } from "./errors";
import * as localStorage from "./localStorage";
import { useNavigation } from "./navigation";
import PageContentContainer from "./PageContentContainer";

export default function HomePage() {
    const navigation = useNavigation();

    const errorReporter = useErrorReporter();

    const [joiningMeeting, setJoiningMeeting] = useState(false);

    async function handleStartMeeting() {
        let meeting: Meeting;
        try {
            meeting = await api.startMeeting();
        } catch (error) {
            errorReporter.unexpectedError({
                title: "Could not start meeting",
                error: error,
            });
            return;
        }
        navigation.joinMeeting(meeting.meetingCode);
    }

    function handleJoinMeetingClick() {
        setJoiningMeeting(true);
    }

    return (
        <Center width="100vw" height="100vh">
            {!joiningMeeting ? (
                <ButtonGroup>
                    <Button onClick={handleStartMeeting}>Start meeting</Button>
                    <Button onClick={handleJoinMeetingClick}>Join meeting</Button>
                </ButtonGroup>
            ) : (
                <PageContentContainer>
                    <JoinMeetingForm />
                </PageContentContainer>
            )}
        </Center>
    );
}

function JoinMeetingForm() {
    const [meetingCode, setMeetingCode] = useState("");
    const [name, setName] = useState(localStorage.getName() ?? "");

    const navigation = useNavigation();

    const errorReporter = useErrorReporter();

    const handleSubmit = async (event: React.SyntheticEvent) => {
        event.preventDefault();

        const trimmedMeetingCode = meetingCode.trim();

        let meeting: Meeting | null;
        try {
            meeting = await api.fetchMeetingByMeetingCode(trimmedMeetingCode);
        } catch (error) {
            errorReporter.unexpectedError({
                title: "Could not join meeting",
                error: error,
            });
            return;
        }

        if (meeting === null) {
            errorReporter.error({
                title: "Could not find meeting",
                description: (
                    <>
                        There doesn't seem to be a meeting with the code <strong>{trimmedMeetingCode}</strong>.
                    </>
                ),
            });
        } else {
            navigation.joinMeeting(trimmedMeetingCode, {name: name});
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <FormControl>
                <FormLabel>Meeting code</FormLabel>
                <Input
                    autoFocus
                    type="text"
                    onChange={event => setMeetingCode(event.target.value)}
                    value={meetingCode}
                />
            </FormControl>
            <FormControl mt={2}>
                <FormLabel>Name</FormLabel>
                <Input
                    type="text"
                    onChange={event => setName(event.target.value)}
                    value={name}
                />
            </FormControl>
            <Button disabled={meetingCode === "" || name === ""} mt={4} type="submit">Join</Button>
        </form>
    );
}
