import {
    Button,
    Checkbox,
    FormControl,
    FormLabel,
    Input,
 } from "@chakra-ui/react";
import { useState } from "react";

import { Meeting } from "../../server/lib/meetings";
import * as api from "./api";
import { AppBar } from "./AppBar";
import { useErrorReporter } from "./errors";
import * as localStorage from "./localStorage";
import { useNavigation } from "./navigation";
import PageContentContainer from "./PageContentContainer";

export default function StartMeetingPage() {
    return (
        <>
            <AppBar>Start meeting</AppBar>
            <PageContentContainer>
                <StartMeetingForm />
            </PageContentContainer>
        </>
    );
}

function StartMeetingForm() {
    const [name, setName] = useState(localStorage.getName() ?? "");
    const [hasQueue, setHasQueue] = useState(false);

    const navigation = useNavigation();

    const errorReporter = useErrorReporter();

    const handleSubmit = async (event: React.SyntheticEvent) => {
        event.preventDefault();

        let meeting: Meeting;
        try {
            meeting = await api.startMeeting({hasQueue: hasQueue});
        } catch (error) {
            errorReporter.unexpectedError({
                title: "Could not start meeting",
                error: error,
            });
            return;
        }
        navigation.joinMeeting(meeting.meetingCode, {name: name});
    };

    return (
        <form onSubmit={handleSubmit}>
            <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                    type="text"
                    onChange={event => setName(event.target.value)}
                    value={name}
                />
            </FormControl>
            <FormControl mt={2}>
                <Checkbox
                    checked={hasQueue}
                    onChange={event => setHasQueue(event.target.checked)}
                >
                    Use queue
                </Checkbox>
            </FormControl>
            <Button disabled={name === ""} mt={4} type="submit">Start meeting</Button>
        </form>
    );
}

