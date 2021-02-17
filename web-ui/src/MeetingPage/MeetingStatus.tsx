import {
    Tab,
    Tabs,
    TabList,
    TabPanel,
    TabPanels,
} from "@chakra-ui/react";

import { Meeting, Member } from "server/lib/meetings";
import MembersList from "./MembersList";

interface MeetingStatusProps {
    meeting: Meeting;
    member: Member;
}

export default function MeetingStatus(props: MeetingStatusProps) {
    const {meeting, member} = props;

    if (meeting.hasQueue) {
        return (
            <Tabs isFitted>
                <TabList>
                    <Tab>Queue</Tab>
                    <Tab>Members</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                    </TabPanel>
                    <TabPanel>
                        <MembersList meeting={meeting} memberId={member.memberId} />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        );
    } else {
        return (
            <MembersList meeting={meeting} memberId={member.memberId} />
        );
    }
}
