import { Section } from "@/src/client/components/global/layout/Section";
import { Container } from "@/src/client/components/global/layout/Container";
import { IkigaiTimeline } from "./ikigaiTimeline";
import { FeatureSection } from "./FeatureSection";
import { ProgressSection } from "./ProgressSection";

export function Ikigai() {
    return (
        <Section spacing="xs">
            <Container size="full">
                <IkigaiTimeline />
            </Container>
            <FeatureSection />
            <ProgressSection />
        </Section>
    );
}
