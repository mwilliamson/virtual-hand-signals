import { Box, Heading, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import { useHistory, useLocation } from "react-router-dom";

import notFoundPageStories from "./NotFoundPage.stories";
import pageStories from "./Page.stories";

interface StorySet {
    title: string;
    stories: Array<Story>;
}

interface Story {
    name: string;
    node: React.ReactNode;
}

export default function Stories() {
    const storySets: Array<StorySet> = [notFoundPageStories, pageStories];

    const tabs = storySets.map(storySet => ({
        path: ["stories", storySet.title],
        title: storySet.title,
        node: (
            <StorySetDisplay storySet={storySet} />
        ),
    }))

    return (
        <UrlTabs tabs={tabs} />
    )
}

interface StorySetDisplayProps {
    storySet: StorySet;
}

function StorySetDisplay(props: StorySetDisplayProps) {
    const {storySet: selectedStorySet} = props;

    const tabs = selectedStorySet.stories.map(story => ({
        path: ["stories", selectedStorySet.title, story.name],
        title: story.name,
        node: (
            <>
                <Heading size="md">{selectedStorySet.title}: {story.name}</Heading>
                <Viewport>
                    {story.node}
                </Viewport>
            </>
        ),
    }));

    return (
        <UrlTabs tabs={tabs} />
    );
}

interface UrlTab {
    path: Array<string>;
    title: string;
    node: React.ReactNode;
}

interface UrlTabsProps {
    tabs: Array<UrlTab>;
}

function UrlTabs(props: UrlTabsProps) {
    const {tabs} = props;

    const history = useHistory();
    const location = useLocation();

    const path = location.pathname;
    const pathParts = path.slice(1).split("/");
    const tabIndex = Math.max(0, tabs.findIndex(
        tab => pathToString(pathParts.slice(0, tab.path.length)) === pathToString(tab.path),
    ));

    const handleTabIndexChange = (newIndex: number) => {
        const tab = tabs[newIndex];
        history.push(pathToString(tab.path));
    };

    return (
        <Tabs orientation="vertical" index={tabIndex} onChange={handleTabIndexChange}>
            <TabList>
                {tabs.map(tab => (
                    <Tab key={pathToString(tab.path)}>
                        {tab.title}
                    </Tab>
                ))}
            </TabList>

            <TabPanels>
                {tabs.map(tab => (
                    <TabPanel key={pathToString(tab.path)}>
                        {tab.node}
                    </TabPanel>
                ))}
            </TabPanels>
        </Tabs>
    );
}

interface ViewportProps {
    children: React.ReactNode;
}

function Viewport(props: ViewportProps) {
    const {children} = props;

    return (
        <Box padding={2} mt={2} mb={8} border="1px solid gray">
            {children}
        </Box>
    );
}

function pathToString(path: Array<string>): string {
    return "/" + path.join("/");
}