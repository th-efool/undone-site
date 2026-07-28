"use client";

import { Search, X } from "lucide-react";

import styles from "./SearchBar.module.css";

export interface SearchBarProps {
    value?: string;
    placeholder?: string;

    onChange?(value: string): void;
    onSubmit?(): void;
    onClear?(): void;

    className?: string;
}

export function SearchBar({
                              value = "",
                              placeholder = "Search topics, creators, playlists, skills...",
                              onChange,
                              onSubmit,
                              className,
                              onClear,
                          }: SearchBarProps) {
    return (
        <form
            className={`${styles.searchBar} ${className ?? ""}`}
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit?.();
            }}
        >
            <Search
                size={18}
                strokeWidth={2.2}
                className={styles.icon}
            />

            <input
                className={styles.input}
                type="search"
                value={value}
                placeholder={placeholder}
                onChange={(event) =>
                    onChange?.(event.target.value)
                }
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onChange?.(""); onClear?.(); } }}
            />

            {value ? <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => { onChange?.(""); onClear?.(); }}><X size={15}/></button> : <kbd className={styles.shortcut}>
                ⌘ K
            </kbd>}
        </form>
    );
}