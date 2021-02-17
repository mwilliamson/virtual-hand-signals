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
import { AppBar } from "./AppBar";
import { meetingNotFoundTitle, meetingNotFoundDescription, useErrorReporter } from "./errors";
import * as localStorage from "./localStorage";
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
