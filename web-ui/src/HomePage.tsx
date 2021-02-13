import { Button, ButtonGroup, Center } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";

import * as api from "./api";

export default function HomePage() {
    const history = useHistory();

    async function handleStartMeeting() {
        const meeting = await api.startMeeting();
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
