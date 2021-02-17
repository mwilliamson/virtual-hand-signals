import {
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
} from "@chakra-ui/react";
import MoreVertIcon from "@material-ui/icons/MoreVert";
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
                <MenuItem onClick={() => onChangeName()}>
                    Change name
                </MenuItem>
                <MenuItem onClick={handleLeave}>
                    Leave meeting
                </MenuItem>
            </MenuList>
        </Menu>
    );
}
