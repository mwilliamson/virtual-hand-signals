import {
    Button,
    ButtonGroup,
    Center,
 } from "@chakra-ui/react";

import { AppBar } from "./AppBar";
import { useNavigation } from "./navigation";
import PageContentContainer from "./PageContentContainer";

export default function HomePage() {
    const navigation = useNavigation();

    function handleStartMeetingClick() {
        navigation.startingMeeting();
    }

    function handleJoinMeetingClick() {
        navigation.joiningMeeting();
    }

    return (
        <>
            <AppBar>&nbsp;</AppBar>
            <PageContentContainer>
                <Center>
                    <ButtonGroup>
                        <Button onClick={handleStartMeetingClick}>Start meeting</Button>
                        <Button onClick={handleJoinMeetingClick}>Join meeting</Button>
                    </ButtonGroup>
                </Center>
            </PageContentContainer>
        </>
    );
}
