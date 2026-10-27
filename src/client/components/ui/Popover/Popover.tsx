'use client';

import React from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import clsx from 'clsx';
import styles from './Popover.module.css';

export interface PopoverContentProps extends React.ComponentPropsWithoutRef<typeof RadixPopover.Content> {
  collisionPadding?: number;
  sideOffset?: number;
}

export function PopoverRoot({ children, ...props }: RadixPopover.PopoverProps) {
  return <RadixPopover.Root {...props}>{children}</RadixPopover.Root>;
}

export function PopoverTrigger({ children, ...props }: RadixPopover.PopoverTriggerProps) {
  return <RadixPopover.Trigger {...props}>{children}</RadixPopover.Trigger>;
}

export function PopoverAnchor({ children, ...props }: RadixPopover.PopoverAnchorProps) {
  return <RadixPopover.Anchor {...props}>{children}</RadixPopover.Anchor>;
}

export function PopoverPortal({ children, ...props }: RadixPopover.PopoverPortalProps) {
  return (
    <RadixPopover.Portal {...props}>
      <div className="ud-popover-portal">{children}</div>
    </RadixPopover.Portal>
  );
}

export function PopoverContent({
  collisionPadding = 12,
  sideOffset = 8,
  className,
  children,
  ...props
}: PopoverContentProps) {
  return (
    <RadixPopover.Content
      collisionPadding={collisionPadding}
      sideOffset={sideOffset}
      className={clsx(styles.content, className)}
      {...props}
    >
      {children}
    </RadixPopover.Content>
  );
}

export function PopoverArrow({ className, ...props }: RadixPopover.PopoverArrowProps) {
  return <RadixPopover.Arrow className={clsx(styles.arrow, className)} {...props} />;
}

export const PopoverClose = RadixPopover.Close;

export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Anchor: PopoverAnchor,
  Portal: PopoverPortal,
  Content: PopoverContent,
  Arrow: PopoverArrow,
  Close: PopoverClose,
};

export default Popover;
