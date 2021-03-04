import { ChakraProvider } from "@chakra-ui/react";

export default (props) => (
    <ChakraProvider>
        {props.children}
    </ChakraProvider>
);
