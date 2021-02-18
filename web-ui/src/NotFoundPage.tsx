import { Button } from "@chakra-ui/react";

import { AppBar } from "./AppBar";
import PageContentContainer from "./PageContentContainer";
import { useNavigation } from "./navigation";

export default function NotFoundPage() {
    const navigation = useNavigation();

    return (
        <>
            <AppBar />

            <PageContentContainer>
                <p>Page not found.</p>

                <Button mt={4} onClick={() => navigation.goToHomePage()}>Home page</Button>
            </PageContentContainer>
        </>
    );
}
