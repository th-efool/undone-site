'use client';

import React from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';
import styles from './AttachmentTray.module.css';

export interface ComposerFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  thumbnailUrl?: string;
  status: 'idle' | 'extracting' | 'ready' | 'error';
  error?: string;
}

export interface AttachmentTrayProps {
  files: ComposerFileItem[];
  onRemoveFile: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

export const AttachmentTray: React.FC<AttachmentTrayProps> = ({
  files,
  onRemoveFile,
  disabled = false,
  className = '',
}) => {
  if (files.length === 0) return null;

  return (
    <div
      className={`${styles.trayContainer} ${className}`}
      data-testid="attachment-tray"
      aria-label="Attached files"
    >
      {files.map((item) => {
        const isPdf = item.name.toLowerCase().endsWith('.pdf') || item.type === 'application/pdf';

        return (
          <div
            key={item.id}
            className={styles.fileCard}
            data-testid={`attachment-card-${item.id}`}
            title={`${item.name} (${Math.round(item.size / 1024)} KB)`}
          >
            {/* Top Thumbnail Section */}
            <div className={styles.thumbnailContainer}>
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnailUrl}
                  alt={`Preview of ${item.name}`}
                  className={styles.thumbnailImage}
                />
              ) : (
                <div className={styles.placeholderThumbnail}>
                  <FileText size={28} color="#9ca3af" />
                </div>
              )}

              {item.status === 'extracting' && (
                <div className={styles.extractingOverlay}>
                  <div className={styles.spinner} aria-label="Processing document..." />
                </div>
              )}
            </div>

            {/* Bottom Title / Badge Bar */}
            <div className={styles.bottomBar}>
              {isPdf && <span className={styles.pdfBadge}>PDF</span>}
              <span className={styles.fileName}>{item.name}</span>
            </div>

            {/* Status error flag */}
            {item.status === 'error' && (
              <span className={styles.errorBadge} title={item.error || 'Failed to extract'}>
                <AlertCircle size={12} />
              </span>
            )}

            {/* Remove Button */}
            {!disabled && (
              <button
                type="button"
                className={styles.removeButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(item.id);
                }}
                aria-label={`Remove ${item.name}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

