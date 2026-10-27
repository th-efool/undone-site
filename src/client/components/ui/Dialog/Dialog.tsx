'use client';

import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { X } from 'lucide-react';
import styles from './Dialog.module.css';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  size?: DialogSize;
  showCloseButton?: boolean;
}

export function DialogRoot({ children, ...props }: RadixDialog.DialogProps) {
  return <RadixDialog.Root {...props}>{children}</RadixDialog.Root>;
}

export function DialogTrigger({ children, ...props }: RadixDialog.DialogTriggerProps) {
  return <RadixDialog.Trigger {...props}>{children}</RadixDialog.Trigger>;
}

export function DialogPortal({ children, ...props }: RadixDialog.DialogPortalProps) {
  return (
    <RadixDialog.Portal {...props}>
      <div className="ud-dialog-portal">{children}</div>
    </RadixDialog.Portal>
  );
}

export function DialogOverlay({ className, ...props }: RadixDialog.DialogOverlayProps) {
  return (
    <RadixDialog.Overlay
      className={clsx(styles.overlay, className)}
      {...props}
    />
  );
}

export function DialogContent({
  size = 'md',
  showCloseButton = true,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <RadixDialog.Content
      className={clsx(styles.content, styles[size], className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <RadixDialog.Close
          className={styles.closeButton}
          aria-label="Close dialog"
        >
          <X className={styles.closeIcon} />
        </RadixDialog.Close>
      )}
    </RadixDialog.Content>
  );
}

export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx(styles.header, className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
  ...props
}: RadixDialog.DialogTitleProps) {
  return (
    <RadixDialog.Title
      className={clsx(styles.title, className)}
      {...props}
    >
      {children}
    </RadixDialog.Title>
  );
}

export function DialogDescription({
  className,
  children,
  ...props
}: RadixDialog.DialogDescriptionProps) {
  return (
    <RadixDialog.Description
      className={clsx(styles.description, className)}
      {...props}
    >
      {children}
    </RadixDialog.Description>
  );
}

export function DialogBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx(styles.body, className)} {...props}>
      {children}
    </div>
  );
}

export interface DialogActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end' | 'between';
}

export function DialogActions({
  align = 'end',
  className,
  children,
  ...props
}: DialogActionsProps) {
  return (
    <div
      className={clsx(styles.actions, className)}
      data-align={align}
      {...props}
    >
      {children}
    </div>
  );
}

export const DialogClose = RadixDialog.Close;

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Body: DialogBody,
  Actions: DialogActions,
  Close: DialogClose,
};

export default Dialog;
