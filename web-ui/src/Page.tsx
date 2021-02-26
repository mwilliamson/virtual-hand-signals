import { Box } from "@chakra-ui/react";

import { AppBar } from "./AppBar";
import PageContentContainer from "./PageContentContainer";

interface PageProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    settingsMenuItems?: React.ReactNode;
    stickyTop?: React.ReactNode;
}

export default function Page(props: PageProps) {
    const {children, settingsMenuItems, stickyTop, title} = props;

    return (
        <>
            <Box position="sticky" top={0} zIndex="dropdown">
                <AppBar settingsMenuItems={settingsMenuItems} title={title} />
                {stickyTop}
            </Box>
            <PageContentContainer>
                {children}
            </PageContentContainer>
        </>
    );
}
