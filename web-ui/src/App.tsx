import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";

import JoinMeetingPage from "./JoinMeetingPage";
import HomePage from "./HomePage";
import MeetingPage from "./MeetingPage";
import NotFoundPage from "./NotFoundPage";
import StartMeetingPage from "./StartMeetingPage";
import Stories from "./Stories";

function App() {
    return (
        <ChakraProvider>
            <Router>
                <Switch>
                    <Route path="/" exact>
                        <HomePage />
                    </Route>
                    <Route path="/join" exact>
                        <JoinMeetingPage />
                    </Route>
                    <Route path="/meetings/:meetingCode" exact>
                        <MeetingPage />
                    </Route>
                    <Route path="/start" exact>
                        <StartMeetingPage />
                    </Route>
                    {process.env.NODE_ENV !== "production" && (
                        <>
                            <Route path="/stories" exact>
                                <Stories />
                            </Route>
                            <Route path="/stories/:storySetTitle" exact>
                                <Stories />
                            </Route>
                            <Route path="/stories/:storySetTitle/:storyName" exact>
                                <Stories />
                            </Route>
                        </>
                    )}
                    <Route>
                        <NotFoundPage />
                    </Route>
                </Switch>
            </Router>
        </ChakraProvider>
    );
}

export default App;
