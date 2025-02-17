import { Button } from "@chakra-ui/react";

import { useNavigation } from "./navigation";
import Page from "./Page";

export default function NotFoundPage() {
    const navigation = useNavigation();

    return (
        <Page>
            <p>Page not found.</p>

            <Button mt={4} onClick={() => navigation.goToHomePage()}>Home page</Button>
        </Page>
    );
}
