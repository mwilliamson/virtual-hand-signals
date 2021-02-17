import {
    Alert,
    AlertDescription,
    AlertIcon,
    AlertTitle,
    Box,
    useToast,
} from "@chakra-ui/react";
import { useEffect } from "react";

export const meetingNotFoundTitle = "Could not find meeting";
export const meetingNotFoundDescription = (meetingCode: string) => (
    <>
        There doesn't seem to be a meeting with the code <strong>{meetingCode}</strong>.
    </>
);

const unexpectedErrorTitle = "Something's gone wrong";
const unexpectedErrorDescription = "An unexpected error has occurred.";

export function useErrorReporter() {
    const toast = useToast();

    const error = ({title, description}: {title: string, description?: React.ReactNode}) => {
        toast({
            title: title,
            description: description,
            status: "error",
            isClosable: true,
            duration: null,
        });
    };

    const unexpectedError = ({title = unexpectedErrorTitle, error: err}: {title?: string, error: Error}) => {
        console.error(err);
        error({title, description: unexpectedErrorDescription});
    };

    return {
        error,
        unexpectedError,
    };
}

interface ErrorAlertProps {
    title: string;
    description: React.ReactNode;
}

export function ErrorAlert(props: ErrorAlertProps) {
    const {title, description} = props;

    return (
        <Alert status="error">
            <AlertIcon />
            <Box>
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription display="block">{description}</AlertDescription>
            </Box>
        </Alert>
    );
}

interface UnexpectedErrorAlertProps {
    error: Error;
}

export function UnexpectedErrorAlert(props: UnexpectedErrorAlertProps) {
    const {error} = props;

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <Alert status="error">
            <AlertIcon />
            {unexpectedErrorDescription}
        </Alert>
    );
}
