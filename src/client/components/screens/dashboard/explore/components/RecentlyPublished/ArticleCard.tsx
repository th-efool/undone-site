import { Bookmark, Users } from "lucide-react";

import type { ArticlePreview } from "../../models";

import styles from "./ArticleCard.module.css";

export interface ArticleCardProps {
    item: ArticlePreview;
}

export function ArticleCard({
                                item,
                            }: ArticleCardProps) {
    return (
        <article className={styles.card}>

            <img
                src={item.thumbnail}
                alt=""
                className={styles.thumbnail}
            />

            <div className={styles.content}>

                <div className={styles.top}>

                    <div>

                        <h3 className={styles.title}>
                            {item.title}
                        </h3>

                        <p className={styles.author}>
                            By {item.author}
                        </p>

                    </div>

                    <button
                        className={styles.bookmark}
                        type="button"
                        aria-label="Bookmark"
                    >
                        <Bookmark
                            size={17}
                            strokeWidth={2}
                            fill={item.bookmarked ? "currentColor" : "none"}
                        />
                    </button>

                </div>

                <div className={styles.meta}>

                    <span>
                        <Users size={13} />

                        {item.learnerCount}
                    </span>

                    <span>•</span>

                    <span>{item.publishedLabel}</span>

                </div>

            </div>

        </article>
    );
}