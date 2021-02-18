import {
    Button,
    ButtonGroup,
    Center,
 } from "@chakra-ui/react";

import { useNavigation } from "./navigation";
import Page from "./Page";

export default function HomePage() {
    const navigation = useNavigation();

    function handleStartMeetingClick() {
        navigation.startingMeeting();
    }

    function handleJoinMeetingClick() {
        navigation.joiningMeeting();
    }

    return (
        <Page>
            <Center>
                <ButtonGroup>
                    <Button onClick={handleStartMeetingClick}>Start meeting</Button>
                    <Button onClick={handleJoinMeetingClick}>Join meeting</Button>
                </ButtonGroup>
            </Center>
        </Page>
    );
}
