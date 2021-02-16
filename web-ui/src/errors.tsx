import {
    Alert,
    AlertIcon,
    useToast,
} from "@chakra-ui/react";
import { useEffect } from "react";

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
