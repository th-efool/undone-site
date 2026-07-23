import { Section } from "@/src/client/components/global/layout/Section";
import { IkigaiTimeline } from "./ikigaiTimeline";
import styles from "./ikigai.module.css";
import {Container} from "@/src/client/components/global/layout/Container";

export function Ikigai() {
    return (
        <Section
            spacing="xs"
            className={styles.ikigai}
        >
            <Container size="full">
                <IkigaiTimeline />
            </Container>

            <div className={styles.featureSection}>
                {/* Video */}
                {/* Copy */}
                {/* Phone Illustration */}
            </div>

            <div className={styles.progressSection}>
                {/* Learning List */}
                {/* Calendar */}
                {/* Progress Card */}
            </div>
        </Section>
    );
}