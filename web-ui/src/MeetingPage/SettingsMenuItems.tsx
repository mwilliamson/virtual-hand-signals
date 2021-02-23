import { MenuItem } from "@chakra-ui/react";

import { ClientMessage, ClientMessages } from "server/lib/meetings";
import { useNavigation } from "../navigation";

interface SettingsMenuProps {
    onChangeName: () => void;
    send: (message: ClientMessage) => void;
}

export default function SettingsMenu(props: SettingsMenuProps) {
    const {onChangeName, send} = props;

    const navigation = useNavigation();

    function handleLeave() {
        send(ClientMessages.leave());
        navigation.goToHomePage();
    }

    return (
        <>
            <MenuItem onClick={() => onChangeName()}>
                Change name
            </MenuItem>
            <MenuItem onClick={handleLeave}>
                Leave meeting
            </MenuItem>
        </>
    );
}
