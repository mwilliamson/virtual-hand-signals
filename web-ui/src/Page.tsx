import { Box } from "@chakra-ui/react";

import { AppBar } from "./AppBar";
import PageContentContainer from "./PageContentContainer";

interface PageProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    right?: React.ReactNode;
    stickyTop?: React.ReactNode;
}

export default function Page(props: PageProps) {
    const {children, right, stickyTop, title} = props;

    return (
        <>
            <Box position="sticky" top={0}>
                <AppBar right={right} title={title} />
                {stickyTop}
            </Box>
            <PageContentContainer>
                {children}
            </PageContentContainer>
        </>
    );
}
