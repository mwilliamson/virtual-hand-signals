import {
    Button,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerOverlay,
    Stack,
} from "@chakra-ui/react";
import { useState } from "react";

import { handSignals } from "server/lib/meetings";
import PageContentContainer from "../PageContentContainer";

interface HandSignalControlProps {
    onChange: (value: string | null) => void;
    value: string | null;
}

export default function HandSignalControl(props: HandSignalControlProps) {
    const {onChange, value} = props;

    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

    const handleRaiseHandClick = () => {
        setIsDrawerVisible(true);
    };

    const handleSelectHandSignal = (handSignal: string) => {
        onChange(handSignal);
        setIsDrawerVisible(false);
    };

    const handleLowerHandClick = () => {
        onChange(null);
    };

    const button = value === null ? (
        <Button my={4} onClick={handleRaiseHandClick}>Raise hand</Button>
    ) : (
        <Button my={4} onClick={handleLowerHandClick}>Lower hand</Button>
    );

    return (
        <>
            {button}
            <Drawer placement="top" isOpen={isDrawerVisible} onClose={() => setIsDrawerVisible(false)}>
                <DrawerOverlay>
                    <DrawerContent>
                        <DrawerBody>
                            <PageContentContainer>
                                <Stack spacing={2}>
                                    {handSignals.map(handSignal => (
                                        <Button
                                            key={handSignal}
                                            onClick={() => handleSelectHandSignal(handSignal)}
                                        >
                                            {handSignal}
                                        </Button>
                                    ))}
                                </Stack>
                            </PageContentContainer>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerOverlay>
            </Drawer>
        </>
    );
}
