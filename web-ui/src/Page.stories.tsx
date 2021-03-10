import { MenuItem } from "@chakra-ui/react";

import Page from "./Page";

const exampleText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

export default {
    title: "Page",

    stories: [
        {
            name: "Default title",
            node: <Page>{exampleText}</Page>
        },
        {
            name: "Explicit title",
            node: <Page title="Page title">{exampleText}</Page>
        },
        {
            name: "Settings menu",
            node: (
                <Page
                    settingsMenuItems={
                        (
                            <>
                                <MenuItem>Setting 1</MenuItem>
                                <MenuItem>Setting 2</MenuItem>
                            </>
                        )
                    }
                >
                    {exampleText}
                </Page>
            ),
        }
    ],
};

