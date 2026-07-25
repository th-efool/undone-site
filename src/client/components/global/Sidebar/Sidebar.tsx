"use client";

import Link from "next/link";

import { Logo } from "../Logo";
import { SIDEBAR_ITEMS } from "./sidebar.data";
import { SidebarItem } from "./SidebarItem";

import styles from "./Sidebar.module.css";

export function Sidebar() {
    return (
        <aside className={styles.sidebar}>
            <Logo
                href="/home"
                iconOnly
                priority
                className={styles.logo}
            />

            <nav className={styles.navigation}>
                {SIDEBAR_ITEMS.map((item) => (
                    <SidebarItem
                        key={item.href}
                        {...item}
                    />
                ))}
            </nav>
        </aside>
    );
}