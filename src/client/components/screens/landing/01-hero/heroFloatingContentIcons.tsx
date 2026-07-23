"use client";

import Image from "next/image";
import styles from "./heroFloatingContentIcons.module.css";

const icons = [
    {
        src: "/images/icons/128/Youtube.webp",
        x: "7%",
        y: "14%",
        rotate: -12,
    },
    {
        src: "/images/icons/128/Bookmark.webp",
        x: "16%",
        y: "24%",
        rotate: 10,
    },
    {
        src: "/images/icons/128/Article.webp",
        x: "30%",
        y: "36%",
        rotate: -6,
    },
    {
        src: "/images/icons/128/Headphone.webp",
        x: "8%",
        y: "48%",
        rotate: -8,
    },
    {
        src: "/images/icons/128/Ai.webp",
        x: "43%",
        y: "53%",
        rotate: 4,
    },
    {
        src: "/images/icons/128/Book.webp",
        x: "58%",
        y: "48%",
        rotate: 8,
    },
];

export function HeroFloatingContentIcons() {
    return (
        <div className={styles.container}>
            {icons.map((icon) => (
                <div
                    key={icon.src}
                    className={styles.icon}
                    style={{
                        left: icon.x,
                        top: icon.y,
                        rotate: `${icon.rotate}deg`,
                    }}
                >
                    <Image
                        src={icon.src}
                        alt=""
                        fill
                        draggable={false}
                    />
                </div>
            ))}
        </div>
    );
}