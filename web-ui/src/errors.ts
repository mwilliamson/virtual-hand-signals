import { useToast } from "@chakra-ui/react";

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

    const unexpectedError = ({title = "Something's gone wrong", error: err}: {title?: string, error: Error}) => {
        console.error(err);
        error({title, description: "An unexpected error has been encountered"});
    };

    return {
        error,
        unexpectedError,
    };
}

function unexpectedError() {

}
