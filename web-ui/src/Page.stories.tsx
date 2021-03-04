import React, { ComponentProps } from "react";
import { Story } from "@storybook/react";

import Page from "./Page";

export default {
    title: "Page",
    component: Page,
};

const Template: Story<ComponentProps<typeof Page>> = args => (
    <Page {...args} />
);

export const SimplePage = Template.bind({});
SimplePage.args = {
    title: "TITLE",
    children: "CHILDREN",
};
