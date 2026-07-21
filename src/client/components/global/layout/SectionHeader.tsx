import React from "react";
import clsx from "clsx";

import { Stack } from "./Stack";
import {Badge} from "@/src/client/components/ui/Badge/Badge";
import { Heading } from "@/src/client/components/ui/Typography/Heading";
import { Text } from "@/src/client/components/ui/Typography/Text";

type Align = "left" | "center" | "right";

const alignItems = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
} as const;

const textAlign = {
    left: "left",
    center: "center",
    right: "right",
} as const;

export interface SectionHeaderProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    align?: Align;
    maxWidth?: string;
}

export const SectionHeader = React.forwardRef<
    HTMLDivElement,
    SectionHeaderProps
>(
    (
        {
            eyebrow,
            title,
            description,
            actions,
            align = "left",
            maxWidth = "48rem",
            className,
            style,
            ...props
        },
        ref
    ) => {
        return (
            <Stack
                ref={ref}
                gap="5"
                className={clsx(className)}
                style={{
                    maxWidth,
                    textAlign: textAlign[align],
                    alignItems: alignItems[align],
                    ...style,
                }}
                {...props}
            >
                {eyebrow && (
                    <Badge variant="brand">
                        {eyebrow}
                    </Badge>
                )}

                <Heading level={2}>
                    {title}
                </Heading>

                {description && (
                    <Text variant="lead">
                        {description}
                    </Text>
                )}

                {actions}
            </Stack>
        );
    }
);

SectionHeader.displayName = "SectionHeader";