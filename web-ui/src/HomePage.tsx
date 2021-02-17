import {
    Button,
    ButtonGroup,
 } from "@chakra-ui/react";

import { Meeting } from "../../server/lib/meetings";
import * as api from "./api";
import { AppBar } from "./AppBar";
import { useErrorReporter } from "./errors";
import { useNavigation } from "./navigation";
import PageContentContainer from "./PageContentContainer";

export default function HomePage() {
    const navigation = useNavigation();

    const errorReporter = useErrorReporter();

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
        navigation.joiningMeeting();
    }

    return (
        <>
            <AppBar>&nbsp;</AppBar>
            <PageContentContainer>
                <ButtonGroup>
                    <Button onClick={handleStartMeeting}>Start meeting</Button>
                    <Button onClick={handleJoinMeetingClick}>Join meeting</Button>
                </ButtonGroup>
            </PageContentContainer>
        </>
    );
}
