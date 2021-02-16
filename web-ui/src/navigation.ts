import { useHistory } from "react-router-dom";

export type JoinMeetingHistoryState = {name: string} | undefined;

export function useNavigation() {
    const history = useHistory();

    return {
        goToHomePage() {
            history.push("/");
        },

        joinMeeting(meetingCode: string, state?: JoinMeetingHistoryState) {
            history.push(`/meetings/${meetingCode}`, state);
        },
    };
}
