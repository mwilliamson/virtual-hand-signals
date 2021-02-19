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
            <Center my={10}>
                <ButtonGroup>
                    <Button onClick={handleStartMeetingClick}>Start meeting</Button>
                    <Button onClick={handleJoinMeetingClick}>Join meeting</Button>
                </ButtonGroup>
            </Center>

            <Heading as="h2" size="sm" mt={10} mb={4}>
                Why use hand signals?
            </Heading>

            <Text my={4}>
                Hand signals are a way to make participation in meetings more equitable.
                Free-form conversation tends to lead to the same people doing most of the talking,
                whether because they're more senior, quicker to speak, have less laggy Internet connections,
                or a host of other reasons.
                In my experience, the quieter participants have thoughts that are just as valuable
                &ndash; I've been in plenty of meetings where I wanted to ask for a clarification,
                or had an important point to add, but couldn't get a word in before another speaker moved the conversation on &ndash;
                so could adding a little structure give more equal opportunity to speak?
            </Text>

            <Text my={4}>
                This app takes inspiration from {" "}
                <Link
                    color="blue.500"
                    href="https://gds.blog.gov.uk/2016/10/07/platform-as-a-service-team-takes-even-handed-approach-to-meetings/"
                >
                    a blog post from the (UK) Government Digital Service (GDS)
                </Link>
                {" "} by suggesting hand signals as a visual way of indicating that you want to speak.
                This can be especially useful when in a conference call,
                but using the video in the call doesn't always work:
                for instance, some people might not have their video turned on,
                or you might not be able to see all the participants, such as when someone is presenting slides.
            </Text>

            <Text my={4}>
                Using this app on your phone or computer means you can see when people want to speak,
                without requiring everyone to have both working video cameras and being able to see the video
                of all participants.
            </Text>
        </Page>
    );
}
