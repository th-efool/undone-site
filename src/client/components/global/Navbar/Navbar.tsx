"use client";

import Link from "next/link";
import clsx from "clsx";

import { Container } from "../layout/Container";
import { Cluster } from "../layout/Cluster";
import { Logo } from "../Logo/Logo";
import { Button } from "@/src/client/components/ui/Button/Button";

import "./navbar.css";

export interface NavItem {
    label: string;
    href: string;
}

export interface NavbarProps {
    links?: NavItem[];

    sticky?: boolean;

    transparent?: boolean;

    ctaLabel?: string;

    ctaHref?: string;

    className?: string;
}

const defaultLinks: NavItem[] = [
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

export function Navbar({
                           links = defaultLinks,

                           sticky = true,

                           transparent = false,

                           ctaLabel = "Get Started",

                           ctaHref = "/signup",

                           className,
                       }: NavbarProps) {
    return (
        <header
            className={clsx(
                "navbar",

                {
                    "navbar-sticky": sticky,
                    "navbar-transparent": transparent,
                },

                className
            )}
        >
            <Container size="2xl">
                <div className="navbar-inner">

                    <Logo />

                    <nav
                        className="navbar-nav"
                        aria-label="Primary Navigation"
                    >
                        <Cluster gap="8">
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="navbar-link"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </Cluster>
                    </nav>

                    <Cluster gap="3">

                        <Button
                            variant="ghost"
                        >
                            Login
                        </Button>

                        <Link href={ctaHref}>
                            <Button>
                                {ctaLabel}
                            </Button>
                        </Link>

                    </Cluster>

                </div>
            </Container>
        </header>
    );
}