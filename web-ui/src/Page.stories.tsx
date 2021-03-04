import { MenuItem } from "@chakra-ui/react";
import React from "react";
import { Story } from "@storybook/react";

import Page, { PageProps } from "./Page";

const exampleText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

export default {
    title: "Page",
    component: Page,
};

const Template: Story<PageProps> = (args) => (
    <Page {...args} />
);

export const PageWithDefaultTitle = Template.bind({});
PageWithDefaultTitle.args = {
    children: exampleText,
};

export const PageWithExplicitTitle = Template.bind({});
PageWithExplicitTitle.args = {
    children: exampleText,
    title: "Page title",
};

export const PageWithSettingsMenu = Template.bind({});
PageWithSettingsMenu.args = {
    settingsMenuItems: (
        <>
            <MenuItem>Setting 1</MenuItem>
            <MenuItem>Setting 2</MenuItem>
        </>
    ),
};
