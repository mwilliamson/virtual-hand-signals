import {
    Box,
    Flex,
    Stack,
} from "@chakra-ui/react";
import PersonIcon from "@material-ui/icons/Person";

import { Meeting } from "server/lib/meetings";

interface MembersListProps {
    meeting: Meeting;
    memberId: string;
}

export default function MembersList(props: MembersListProps) {
    const {meeting, memberId} = props;

    return (
        <Stack spacing={2}>
            {meeting.members.valueSeq().map(member => (
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
