import { Button, ButtonGroup, Center, useToast } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";
import { useState } from "react";

import { Meeting } from "../../server/lib/meetings";
import * as api from "./api";

export default function HomePage() {
    const history = useHistory();

    const [error, setError] = useState<Error | null>(null);
    const toast = useToast();

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
        history.push(`/meetings/${meeting.meetingCode}`);
    }

    return (
        <Center width="100vw" height="100vh">
            <ButtonGroup>
                <Button onClick={handleStartMeeting}>Start meeting</Button>
                <Button>Join meeting</Button>
            </ButtonGroup>
        </Center>
    );
}
