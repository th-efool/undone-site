import Link from "next/link";

import { Container } from "../layout/Container";
import { Stack } from "../layout/Stack";
import { Cluster } from "../layout/Cluster";
import { Divider } from "@/src/client/components/ui/Divider/Divider";
import { Logo } from "../Logo/Logo";

import styles from "./Footer.module.css";

export interface FooterLink {
    label: string;
    href: string;
}

export interface FooterProps {
    description?: string;

    navigation?: FooterLink[];

    social?: FooterLink[];
}

const defaultNavigation: FooterLink[] = [
    {
        label: "Features",
        href: "#features",
    },
    {
        label: "Community",
        href: "#community",
    },
    {
        label: "Pricing",
        href: "#pricing",
    },
];

const defaultSocial: FooterLink[] = [
    {
        label: "Discord",
        href: "#",
    },
    {
        label: "GitHub",
        href: "#",
    },
    {
        label: "LinkedIn",
        href: "#",
    },
];

const currentYear = new Date().getFullYear();

export function Footer({
                           description = "The easiest way to stay consistent with everything you want to learn.",

                           navigation = defaultNavigation,

                           social = defaultSocial,
                       }: FooterProps) {
    return (
        <footer className={styles.footer}>
            <Container size="2xl">

                <div className={styles.grid}>

                    <Stack gap="4">

                        <Logo compact />

                        <p className={styles.description}>
                            {description}
                        </p>

                    </Stack>

                    <Stack
                        as="nav"
                        gap="4"
                        aria-label="Footer explore"
                    >

                        <h4 className={styles.heading}>
                            Explore
                        </h4>

                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={styles.link}
                            >
                                {item.label}
                            </Link>
                        ))}

                    </Stack>

                    <Stack
                        as="nav"
                        gap="4"
                        aria-label="Footer social"
                    >

                        <h4 className={styles.heading}>
                            Connect
                        </h4>

                        {social.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={styles.link}
                            >
                                {item.label}
                            </Link>
                        ))}

                    </Stack>

                </div>

                <Divider
                    className={styles.divider}
                />

                <Cluster justify="between">

                    <small className={styles.copy}>
                        © {currentYear} SideQuestHQ. All rights reserved.
                    </small>

                    <Cluster
                        as="nav"
                        gap="6"
                        aria-label="Footer legal"
                    >

                        <Link
                            href="/privacy"
                            className={styles.link}
                        >
                            Privacy
                        </Link>

                        <Link
                            href="/terms"
                            className={styles.link}
                        >
                            Terms
                        </Link>

                    </Cluster>

                </Cluster>

            </Container>
        </footer>
    );
}
