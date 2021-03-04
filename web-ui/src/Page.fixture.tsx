import { ChakraProvider } from "@chakra-ui/react";

import Page from "./Page";

export default (
    <ChakraProvider>
        <Page title="TITLE">
            CHILDREN
        </Page>
    </ChakraProvider>
);
