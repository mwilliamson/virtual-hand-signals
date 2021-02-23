import {
    Button,
    FormControl,
    FormLabel,
    Input,
 } from "@chakra-ui/react";
import { useState } from "react";

import { MeetingDetails } from "../../server/lib/meetings";
import * as api from "./api";
import { meetingNotFoundTitle, meetingNotFoundDescription, useErrorReporter } from "./errors";
import * as localStorage from "./localStorage";
import { useNavigation } from "./navigation";
import Page from "./Page";

export default function JoinMeetingPage() {
    return (
        <Page title="Join meeting">
            <JoinMeetingForm />
        </Page>
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

        let meeting: MeetingDetails | null;
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
                title: meetingNotFoundTitle,
                description: meetingNotFoundDescription(trimmedMeetingCode),
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
                <FormLabel>Your name</FormLabel>
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
