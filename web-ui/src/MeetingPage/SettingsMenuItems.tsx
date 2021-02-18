import { MenuItem } from "@chakra-ui/react";
import { useNavigation } from "../navigation";

interface SettingsMenuProps {
    onChangeName: () => void;
}

export default function SettingsMenu(props: SettingsMenuProps) {
    const {onChangeName} = props;

    const navigation = useNavigation();

    function handleLeave() {
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
