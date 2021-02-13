import { useParams } from "react-router-dom";

export default function MeetingPage() {
    const {meetingCode} = useParams<{meetingCode: string}>();
    return <>Meeting: {meetingCode}</>;
}
