import Link from "next/link";

import { Container } from "../layout/Container";
import { Stack } from "../layout/Stack";
import { Cluster } from "../layout/Cluster";
import { Divider } from "@/src/client/components/ui/Divider/Divider";
import { Logo } from "../Logo/Logo";

import "./footer.css";

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

export function Footer({
                           description = "The easiest way to stay consistent with everything you want to learn.",

                           navigation = defaultNavigation,

                           social = defaultSocial,
                       }: FooterProps) {
    return (
        <footer className="footer">
            <Container size="2xl">

                <div className="footer-grid">

                    <Stack gap="4">

                        <Logo compact />

                        <p className="footer-description">
                            {description}
                        </p>

                    </Stack>

                    <Stack gap="4">

                        <h4 className="footer-heading">
                            Explore
                        </h4>

                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="footer-link"
                            >
                                {item.label}
                            </Link>
                        ))}

                    </Stack>

                    <Stack gap="4">

                        <h4 className="footer-heading">
                            Connect
                        </h4>

                        {social.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="footer-link"
                            >
                                {item.label}
                            </Link>
                        ))}

                    </Stack>

                </div>

                <Divider
                    style={{
                        marginBlock: "var(--space-10)",
                    }}
                />

                <Cluster justify="between">

                    <small className="footer-copy">
                        © {new Date().getFullYear()} SideQuestHQ. All rights reserved.
                    </small>

                    <Cluster gap="6">

                        <Link
                            href="/privacy"
                            className="footer-link"
                        >
                            Privacy
                        </Link>

                        <Link
                            href="/terms"
                            className="footer-link"
                        >
                            Terms
                        </Link>

                    </Cluster>

                </Cluster>

            </Container>
        </footer>
    );
}