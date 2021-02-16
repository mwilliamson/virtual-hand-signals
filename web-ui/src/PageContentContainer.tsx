import { Container } from "@chakra-ui/react";

interface PageContentContainerProps {
    children: React.ReactNode;
}

export default function PageContentContainer(props: PageContentContainerProps) {
    const {children} = props;

    return (
        <Container maxWidth="sm">
            {children}
        </Container>
    );
}
