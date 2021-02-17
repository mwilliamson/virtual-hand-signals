import { useHistory } from "react-router-dom";

export type JoinMeetingHistoryState = {name: string} | null | undefined;

export function useNavigation() {
    const history = useHistory();

    return {
        goToHomePage() {
            history.push("/");
        },

        joinMeeting(meetingCode: string, state?: JoinMeetingHistoryState) {
            history.push(`/meetings/${meetingCode}`, state);
        },

        joiningMeeting() {
            history.push("/join");
        },

        startingMeeting() {
            history.push("/start");
        },
    };
}
