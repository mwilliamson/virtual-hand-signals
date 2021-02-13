import { ChakraProvider } from "@chakra-ui/react";
import React from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";

import HomePage from "./HomePage";
import MeetingPage from "./MeetingPage";

function App() {
    return (
        <ChakraProvider>
            <Router>
                <Route path="/" exact>
                    <HomePage />
                </Route>
                <Route path="/meetings/:meetingCode" exact>
                    <MeetingPage />
                </Route>
            </Router>
        </ChakraProvider>
    );
}

export default App;
