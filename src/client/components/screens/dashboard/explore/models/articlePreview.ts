import type { ContentProvider } from "@/src/client/components/global/ProviderBadge/types";

export interface ArticlePreview {
    id: string;

    title: string;

    author: string;

    thumbnail: string;

    learnerCount: string;

    publishedLabel: string;

    bookmarked: boolean;
}