import { Box, Heading, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import { useHistory, useParams } from "react-router-dom";

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

    const {
        storySetTitle: selectedStorySetTitle,
        storyName: selectedStoryName,
    } = useParams<{storySetTitle?: string, storyName?: string}>();
    const history = useHistory();

    const tabIndex = Math.max(0, storySets.findIndex(storySet => storySet.title === selectedStorySetTitle));

    const handleTabIndexChange = (newIndex: number) => {
        const storySet = storySets[newIndex];
        history.push(`/stories/${storySet.title}`);
    };

    return (
        <Tabs orientation="vertical" index={tabIndex} onChange={handleTabIndexChange}>
            <TabList>
                {storySets.map(storySet => (
                    <Tab key={storySet.title}>{storySet.title}</Tab>
                ))}
            </TabList>

            <TabPanels>
                {storySets.map(storySet => (
                    <TabPanel key={storySet.title}>
                        <StorySetDisplay storySet={storySet} selectedStoryName={selectedStoryName} />
                    </TabPanel>
                ))}
            </TabPanels>
        </Tabs>
    );
}

interface StorySetDisplayProps {
    storySet: StorySet;
    selectedStoryName: string | undefined;
}

function StorySetDisplay(props: StorySetDisplayProps) {
    const {storySet: selectedStorySet, selectedStoryName} = props;

    const history = useHistory();

    const tabIndex = Math.max(0, selectedStorySet.stories.findIndex(story => story.name === selectedStoryName));

    const handleTabIndexChange = (newIndex: number) => {
        const story = selectedStorySet.stories[newIndex];
        history.push(`/stories/${selectedStorySet.title}/${story.name}`);
    };

    return (
        <Tabs orientation="vertical" index={tabIndex} onChange={handleTabIndexChange}>
            <TabList>
                {selectedStorySet.stories.map(story => (
                    <Tab key={story.name}>{story.name}</Tab>
                ))}
            </TabList>

            <TabPanels>
                {selectedStorySet.stories.map(story => (
                    <TabPanel key={story.name}>
                        <Heading size="md">{selectedStorySet.title}: {story.name}</Heading>
                        <Viewport>
                            {story.node}
                        </Viewport>
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