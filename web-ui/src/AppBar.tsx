import {
    Box,
    Flex,
    IconButton,
    Menu,
    MenuButton,
    MenuList,
 } from "@chakra-ui/react";
import MoreVertIcon from "@material-ui/icons/MoreVert";

import PageContentContainer from "./PageContentContainer";

interface AppBarProps {
    settingsMenuItems?: React.ReactNode;
    title?: React.ReactNode;
}

export function AppBar(props: AppBarProps) {
    const {settingsMenuItems, title = "Virtual hand signals"} = props;

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
                    {settingsMenuItems && (
                        <Box>
                            <Menu placement="bottom-end">
                                <MenuButton
                                    display="block"
                                    as={IconButton}
                                    icon={<MoreVertIcon />}
                                    variant="unstyled"
                                    size="xs"
                                    aria-label="Settings"
                                />
                                <MenuList color="black">
                                    {settingsMenuItems}
                                </MenuList>
                            </Menu>
                        </Box>
                    )}
                </Flex>
            </PageContentContainer>
        </Box>
    );
}
