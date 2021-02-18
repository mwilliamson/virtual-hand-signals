import {
    Button,
    ButtonGroup,
    Center,
    Heading,
    Link,
    Text,
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

            <Heading as="h2" size="sm" mt={4}>
                Why use hand signals?
            </Heading>

            <Text>
                <Link
                    color="blue.500"
                    href="https://gds.blog.gov.uk/2016/10/07/platform-as-a-service-team-takes-even-handed-approach-to-meetings/"
                >
                    Inspired by a blog post from the (UK) Government Digital Service (GDS).
                </Link>
            </Text>
        </Page>
    );
}
