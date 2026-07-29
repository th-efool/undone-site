import React from 'react';
import clsx from 'clsx';

import { Stack } from './Stack';
import { Badge } from '@/src/client/components/ui/Badge/Badge';
import { Heading } from '@/src/client/components/ui/Typography/Heading';
import { Text } from '@/src/client/components/ui/Typography/Text';
import styles from './Layout.module.css';

type Align = 'left' | 'center' | 'right';

const alignClasses: Record<Align, string> = {
  left: styles.sectionHeaderLeft,
  center: styles.sectionHeaderCenter,
  right: styles.sectionHeaderRight,
};

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  align?: Align;
  maxWidth?: string;
}

export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  (
    {
      eyebrow,
      title,
      description,
      actions,
      align = 'left',
      maxWidth = '48rem',
      className,
      style,
      ...props
    },
    ref,
  ) => {
    return (
      <Stack
        ref={ref}
        gap="5"
        className={clsx(alignClasses[align], className)}
        style={{
          maxWidth,
          ...style,
        }}
        {...props}
      >
        {eyebrow && <Badge variant="brand">{eyebrow}</Badge>}

        <Heading level={2}>{title}</Heading>

        {description && <Text variant="lead">{description}</Text>}

        {actions}
      </Stack>
    );
  },
);

SectionHeader.displayName = 'SectionHeader';
