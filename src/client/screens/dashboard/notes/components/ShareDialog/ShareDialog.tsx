'use client';

import React, { useState } from 'react';
import { Copy, UserPlus, Check } from 'lucide-react';
import { Dialog } from '@/src/client/components/ui/Dialog';
import { Heading } from '@/src/client/components/ui/Typography';
import { Button } from '@/src/client/components/ui/Button';
import { TextField, SelectField, CheckboxField } from '@/src/client/components/ui/Field';
import type { NoteDocument, Permission } from '../../models/notes.models';
import styles from './ShareDialog.module.css';

export interface ShareDialogProps {
  note: NoteDocument;
  onClose: () => void;
  onSave: (patch: Partial<NoteDocument>) => void;
  open?: boolean;
}

export function ShareDialog({
  note,
  onClose,
  onSave,
  open = true,
}: ShareDialogProps) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const displayTitle = note.title ? note.title.trim() : 'Untitled Note';
  const isPublic = Boolean(note.publicLink && String(note.publicLink) !== 'false');

  const handleShareWithUser = () => {
    if (email.trim()) {
      const existing = note.sharedWith || [];
      onSave({
        shared: true,
        sharedWith: [...existing, email.trim()],
      });
      setEmail('');
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      const origin = window.location.origin || '';
      navigator.clipboard.writeText(`${origin}/notes/${note.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <Dialog.Content size="md" className={styles.dialogContent}>
        <Dialog.Header>
          <Dialog.Title asChild>
            <Heading level={2} uiRole="ui-title">
              Share “{displayTitle}”
            </Heading>
          </Dialog.Title>
        </Dialog.Header>

        <Dialog.Body className={styles.body}>
          {/* Public Link Toggle */}
          <div className={styles.publicSection}>
            <CheckboxField
              label="Public link"
              description="Anyone with this link can view this note"
              checked={isPublic}
              onChange={(e) => onSave({ publicLink: e.target.checked })}
            />
          </div>

          {/* Collaborator Share Form */}
          <div className={styles.shareSection}>
            <span className={styles.sectionHeading}>Invite collaborators</span>
            <div className={styles.shareLine}>
              <div className={styles.emailField}>
                <TextField
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleShareWithUser();
                    }
                  }}
                  aria-label="Collaborator email"
                />
              </div>

              <div className={styles.permissionSelect}>
                <SelectField
                  value={note.permission || 'viewer'}
                  onChange={(e) => onSave({ permission: e.target.value as Permission })}
                  aria-label="Permission level"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </SelectField>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleShareWithUser}
              disabled={!email.trim()}
              leftIcon={<UserPlus size={14} />}
              className={styles.shareButton}
            >
              Share with user
            </Button>
          </div>

          {/* Existing Collaborators List */}
          {note.sharedWith && note.sharedWith.length > 0 && (
            <div className={styles.collaboratorsList}>
              <span className={styles.sectionHeading}>Shared with</span>
              {note.sharedWith.map((collaborator) => (
                <div key={collaborator} className={styles.collaboratorItem}>
                  <span className={styles.collaboratorEmail}>{collaborator}</span>
                  <span className={styles.collaboratorBadge}>
                    {note.permission || 'viewer'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Dialog.Body>

        <Dialog.Actions align="between">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopyLink}
            leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
          >
            {copied ? 'Link Copied!' : 'Copy Link'}
          </Button>

          <Button type="button" variant="primary" onClick={onClose}>
            Done
          </Button>
        </Dialog.Actions>
      </Dialog.Content>
    </Dialog.Root>
  );
}
