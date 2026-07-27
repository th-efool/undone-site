"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
    PropsWithChildren,
    useEffect,
    useRef,
    useState,
} from "react";

import styles from "./HorizontalScroller.module.css";

export interface HorizontalScrollerProps
    extends PropsWithChildren {
    className?: string;

    scrollAmount?: number;
}

export function HorizontalScroller({
                                       children,
                                       className,
                                       scrollAmount = 320,
                                   }: HorizontalScrollerProps) {
    const viewportRef = useRef<HTMLDivElement>(null);

    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(false);

    function updateButtons() {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        setShowLeft(viewport.scrollLeft > 1);

        setShowRight(
            viewport.scrollLeft + viewport.clientWidth <
            viewport.scrollWidth - 1,
        );
    }

    function scroll(offset: number) {
        viewportRef.current?.scrollBy({
            left: offset,
            behavior: "smooth",
        });
    }

    useEffect(() => {
        updateButtons();

        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        viewport.addEventListener("scroll", updateButtons);

        window.addEventListener("resize", updateButtons);

        return () => {
            viewport.removeEventListener(
                "scroll",
                updateButtons,
            );

            window.removeEventListener(
                "resize",
                updateButtons,
            );
        };
    }, []);

    return (
        <div className={`${styles.wrapper} ${className ?? ""}`}>
            {showLeft && (
                <button
                    className={`${styles.arrow} ${styles.left}`}
                    onClick={() => scroll(-scrollAmount)}
                    type="button"
                >
                    <ChevronLeft size={20} />
                </button>
            )}

            <div
                ref={viewportRef}
                className={styles.viewport}
            >
                <div className={styles.track}>
                    {children}
                </div>
            </div>

            {showRight && (
                <button
                    className={`${styles.arrow} ${styles.right}`}
                    onClick={() => scroll(scrollAmount)}
                    type="button"
                >
                    <ChevronRight size={20} />
                </button>
            )}
        </div>
    );
}