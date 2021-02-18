import { Box } from "@chakra-ui/react";

import PageContentContainer from "./PageContentContainer";

interface AppBarProps {
    children?: React.ReactNode;
}

export function AppBar(props: AppBarProps) {
    const {children = "Virtual hand signals"} = props;

    return (
        <Box
            color="white"
            bg="blue.500"
            py={2}
            marginBottom={2}
            fontWeight="bold"
            position="sticky"
            top={0}
            zIndex={100}
        >
            <PageContentContainer>
                {children}
            </PageContentContainer>
        </Box>
    );
}
