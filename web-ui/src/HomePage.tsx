import {
    Button,
    ButtonGroup,
    Center,
    FormControl,
    FormLabel,
    Input,
    useToast,
 } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";
import { useState } from "react";

import { Meeting } from "../../server/lib/meetings";
import * as api from "./api";
import PageContentContainer from "./PageContentContainer";

export default function HomePage() {
    const navigation = useNavigation();

    const [error, setError] = useState<Error | null>(null);
    const toast = useToast();

    const [joiningMeeting, setJoiningMeeting] = useState(false);

    async function handleStartMeeting() {
        let meeting: Meeting;
        try {
            meeting = await api.startMeeting();
        } catch (error) {
            console.error(error);
            setError(error);
            toast({
                title: "Could not start meeting",
                status: "error",
                isClosable: true,
                duration: null,
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

    const navigation = useNavigation();

    const handleSubmit = (event: React.SyntheticEvent) => {
        event.preventDefault();
        // TODO: check meeting exists
        navigation.joinMeeting(meetingCode);
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
            <Button disabled={meetingCode === ""} mt={4} type="submit">Join</Button>
        </form>
    );
}

function useNavigation() {
    const history = useHistory();

    return {
        joinMeeting(meetingCode: string) {
            history.push(`/meetings/${meetingCode}`);
        },
    };
}
