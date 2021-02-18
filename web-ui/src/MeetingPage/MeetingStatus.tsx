import {
    Box,
    Flex,
    Stack,
    Tab,
    Tabs,
    TabList,
    TabPanel,
    TabPanels,
} from "@chakra-ui/react";
import PersonIcon from "@material-ui/icons/Person";
import { List, Seq } from "immutable";

import { Meeting, Member } from "server/lib/meetings";

interface MeetingStatusProps {
    meeting: Meeting;
    member: Member;
}

export default function MeetingStatus(props: MeetingStatusProps) {
    const {meeting, member} = props;

    if (meeting.queue === null) {
        return (
            <MembersList members={meeting.members.valueSeq()} memberId={member.memberId} />
        );
    } else {
        return (
            <Tabs isFitted>
                <TabList>
                    <Tab>Queue</Tab>
                    <Tab>Members ({meeting.members.size})</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                        <Queue meeting={meeting} memberId={member.memberId} queue={meeting.queue} />
                    </TabPanel>
                    <TabPanel>
                        <MembersList members={meeting.members.valueSeq()} memberId={member.memberId} />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        );
    }
}

interface QueueProps {
    meeting: Meeting;
    memberId: string;
    queue: List<string>;
}

function Queue(props: QueueProps) {
    const {meeting, memberId, queue} = props;

    const queuingMembers = queue.flatMap(queueMemberId => {
        const queueMember = meeting.members.get(queueMemberId);
        return queueMember === undefined ? [] : [queueMember];
    });

    if (queuingMembers.size === 0) {
        return (
            <p>Queue is empty.</p>
        );
    } else {
        return (
            <MembersList members={queuingMembers.toSeq()} memberId={memberId} />
        );
    }
}

interface MembersListProps {
    members: Seq.Indexed<Member>;
    memberId: string;
}

function MembersList(props: MembersListProps) {
    const {members, memberId} = props;

    return (
        <Stack spacing={2}>
            {members.map(member => (
                <Flex key={member.memberId}>
                    <Box flex="1">
                        <Box as="span" color="blue.300" mr={2}>
                            <PersonIcon />
                        </Box>

                        {member.name}
                        {member.memberId === memberId && " (you)"}
                    </Box>
                    <div>
                        {member.handSignal !== null && (
                            <Box as="span" bg="gray.100" borderRadius="lg" px={2} py={1} my={-1}>
                                {member.handSignal}
                            </Box>
                        )}
                    </div>
                </Flex>
            ))}
        </Stack>
    );
}
