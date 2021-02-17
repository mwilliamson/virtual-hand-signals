import { ChakraProvider } from "@chakra-ui/react";
import React from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";

import JoinMeetingPage from "./JoinMeetingPage";
import HomePage from "./HomePage";
import MeetingPage from "./MeetingPage";
import StartMeetingPage from "./StartMeetingPage";

function App() {
    return (
        <ChakraProvider>
            <Router>
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
            </Router>
        </ChakraProvider>
    );
}

export default App;
