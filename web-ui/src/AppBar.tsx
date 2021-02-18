import { Box, Flex } from "@chakra-ui/react";

import PageContentContainer from "./PageContentContainer";

interface AppBarProps {
    right?: React.ReactNode;
    title?: React.ReactNode;
}

export function AppBar(props: AppBarProps) {
    const {right, title = "Virtual hand signals"} = props;

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
                <Flex>
                    <Box flex="1 1 auto">
                        {title}
                    </Box>
                    {right && (
                        <Box>{right}</Box>
                    )}
                </Flex>
            </PageContentContainer>
        </Box>
    );
}
