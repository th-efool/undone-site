'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Shield, UserMinus, ArrowRightLeft, History, Settings } from 'lucide-react';
import {
  STUDY_ROOM_LIMITS,
  type RoomStatus,
  type RoomListing,
  type LifecycleAction,
  type DelegatedRoomRole,
  type RoomControllerDTO,
  type RoomAuditEntryDTO,
} from '@/src/shared/studyroom/contracts';
import styles from './RoomSettingsModal.module.css';

export interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    listing: RoomListing;
    status: RoomStatus;
    capacity: number;
    rules: string | null;
    tags: string[];
    language: string;
    revision: number;
  };
  onUpdated?: (updated: { revision: number; status?: RoomStatus }) => void;
  isOwner?: boolean;
}

type TabKey = 'settings' | 'controllers' | 'transfer' | 'audit';

export function RoomSettingsModal({
  isOpen,
  onClose,
  room,
  onUpdated,
  isOwner = true,
}: RoomSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('settings');

  // Settings form state
  const [title, setTitle] = useState(room.title);
  const [description, setDescription] = useState(room.description || '');
  const [listing, setListing] = useState<RoomListing>(room.listing);
  const [capacity, setCapacity] = useState(room.capacity);
  const [tagsInput, setTagsInput] = useState(room.tags.join(', '));
  const [rules, setRules] = useState(room.rules || '');
  const [currentRevision, setCurrentRevision] = useState(room.revision);
  const [currentStatus, setCurrentStatus] = useState<RoomStatus>(room.status);

  // Controllers state
  const [controllers, setControllers] = useState<RoomControllerDTO[]>([]);
  const [loadingControllers, setLoadingControllers] = useState(false);
  const [newControllerUserId, setNewControllerUserId] = useState('');
  const [newControllerRole, setNewControllerRole] = useState<DelegatedRoomRole>('HOST');

  // Transfer state
  const [transferRecipientId, setTransferRecipientId] = useState('');
  const [pendingTransferId, setPendingTransferId] = useState<string | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<RoomAuditEntryDTO[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Form submission and messages
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLifecycleLoading, setIsLifecycleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load controllers
  const loadControllers = useCallback(async () => {
    setLoadingControllers(true);
    try {
      const res = await fetch(`/api/studyroom/${room.slug}/controllers`);
      if (res.ok) {
        const data = await res.json();
        setControllers(data.controllers || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingControllers(false);
    }
  }, [room.slug]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch(`/api/studyroom/${room.slug}/audit?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.entries || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingAudit(false);
    }
  }, [room.slug]);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    if (activeTab === 'controllers') {
      void Promise.resolve().then(() => {
        if (!ignore) void loadControllers();
      });
    } else if (activeTab === 'audit') {
      void Promise.resolve().then(() => {
        if (!ignore) void loadAuditLogs();
      });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, activeTab, loadControllers, loadAuditLogs]);

  if (!isOpen) return null;

  const handleSaveSettings = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage('Room title cannot be empty.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, STUDY_ROOM_LIMITS.TAGS_MAX_COUNT);

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/studyroom/${room.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: currentRevision,
          title: cleanTitle,
          description: description.trim() || null,
          listing,
          capacity,
          rules: rules.trim() || null,
          tags,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update room settings.');
        setIsSubmitting(false);
        return;
      }

      setCurrentRevision(data.revision);
      setSuccessMessage('Settings updated successfully.');
      setIsSubmitting(false);

      if (onUpdated) {
        onUpdated({ revision: data.revision });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error updating settings.');
      setIsSubmitting(false);
    }
  };

  const handleLifecycleAction = async (action: LifecycleAction) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLifecycleLoading(true);

    try {
      const res = await fetch(`/api/studyroom/${room.slug}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          expectedRevision: currentRevision,
          requestId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `life-${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || `Failed to ${action.toLowerCase()} room.`);
        setIsLifecycleLoading(false);
        return;
      }

      setCurrentStatus(data.status);
      setCurrentRevision(data.revision);
      setSuccessMessage(`Room status changed to ${data.status}.`);
      setIsLifecycleLoading(false);

      if (onUpdated) {
        onUpdated({ revision: data.revision, status: data.status });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error triggering lifecycle.');
      setIsLifecycleLoading(false);
    }
  };

  // Controller delegation
  const handleAssignController = async () => {
    const target = newControllerUserId.trim();
    if (!target) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/studyroom/${room.slug}/controllers/${target}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newControllerRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign controller');

      setSuccessMessage(`Assigned ${target} as ${newControllerRole}.`);
      setNewControllerUserId('');
      void loadControllers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign controller');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeController = async (userId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/studyroom/${room.slug}/controllers/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke controller');

      setSuccessMessage('Controller revoked.');
      void loadControllers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to revoke controller');
    }
  };

  // Ownership transfer
  const handleProposeTransfer = async () => {
    const recipient = transferRecipientId.trim();
    if (!recipient) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/studyroom/${room.slug}/ownership-transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: recipient,
          expectedRevision: currentRevision,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to propose ownership transfer');

      setPendingTransferId(data.transfer?.id || 'pending');
      setSuccessMessage(`Ownership transfer proposal sent to ${recipient}.`);
      setTransferRecipientId('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to propose transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!pendingTransferId) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/studyroom/${room.slug}/ownership-transfers/${pendingTransferId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel ownership transfer');

      setPendingTransferId(null);
      setSuccessMessage('Ownership transfer proposal cancelled.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to cancel transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="room-settings-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2 id="room-settings-title" className={styles.title}>
              Manage Room Settings
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
              Revision {currentRevision}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
            disabled={isSubmitting || isLifecycleLoading}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsBar} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={14} style={{ display: 'inline', marginRight: 4 }} />
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'controllers'}
            className={`${styles.tabBtn} ${activeTab === 'controllers' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('controllers')}
          >
            <Shield size={14} style={{ display: 'inline', marginRight: 4 }} />
            Controllers
          </button>
          {isOwner && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'transfer'}
              className={`${styles.tabBtn} ${activeTab === 'transfer' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('transfer')}
            >
              <ArrowRightLeft size={14} style={{ display: 'inline', marginRight: 4 }} />
              Transfer
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <History size={14} style={{ display: 'inline', marginRight: 4 }} />
            Audit Log
          </button>
        </div>

        <div className={styles.body}>
          {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}
          {successMessage && <div className={styles.successBanner}>{successMessage}</div>}

          {/* TAB 1: GENERAL SETTINGS & LIFECYCLE */}
          {activeTab === 'settings' && (
            <>
              {/* Lifecycle State Controls */}
              <div className={styles.lifecycleSection}>
                <div className={styles.lifecycleHeader}>
                  <span className={styles.label}>Lifecycle Status</span>
                  <span className={styles.lifecycleStatus}>{currentStatus}</span>
                </div>
                <div className={styles.lifecycleActions}>
                  {currentStatus === 'DRAFT' && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleLifecycleAction('PUBLISH')}
                      disabled={isLifecycleLoading || isSubmitting}
                    >
                      Publish Room (Open)
                    </button>
                  )}
                  {currentStatus === 'OPEN' && (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.dangerBtn}`}
                      onClick={() => handleLifecycleAction('CLOSE')}
                      disabled={isLifecycleLoading || isSubmitting}
                    >
                      Close Room
                    </button>
                  )}
                  {currentStatus === 'CLOSED' && (
                    <>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => handleLifecycleAction('REOPEN')}
                        disabled={isLifecycleLoading || isSubmitting}
                      >
                        Reopen Room
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.dangerBtn}`}
                        onClick={() => handleLifecycleAction('ARCHIVE')}
                        disabled={isLifecycleLoading || isSubmitting}
                      >
                        Archive Room
                      </button>
                    </>
                  )}
                  {currentStatus === 'ARCHIVED' && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleLifecycleAction('RESTORE')}
                      disabled={isLifecycleLoading || isSubmitting}
                    >
                      Restore to Closed
                    </button>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Room Title</label>
                <input
                  type="text"
                  className={styles.input}
                  value={title}
                  maxLength={STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Atmosphere / Description */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Atmosphere & Goals</label>
                <textarea
                  className={styles.textarea}
                  value={description}
                  maxLength={STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Listing & Capacity */}
              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Listing</label>
                  <select
                    className={styles.select}
                    value={listing}
                    onChange={(e) => setListing(e.target.value as RoomListing)}
                    disabled={isSubmitting}
                  >
                    <option value="LISTED">Listed</option>
                    <option value="UNLISTED">Unlisted</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Capacity (Seats)</label>
                  <input
                    type="number"
                    min={STUDY_ROOM_LIMITS.CAPACITY_MIN}
                    max={STUDY_ROOM_LIMITS.CAPACITY_MAX}
                    className={styles.input}
                    value={capacity}
                    onChange={(e) => setCapacity(parseInt(e.target.value, 10) || STUDY_ROOM_LIMITS.CAPACITY_DEFAULT)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Tags (comma-separated)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Rules */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Room Etiquette / Rules</label>
                <textarea
                  className={styles.textarea}
                  value={rules}
                  placeholder="e.g. Mic muted by default, quiet focus only"
                  maxLength={STUDY_ROOM_LIMITS.RULES_MAX_LENGTH}
                  onChange={(e) => setRules(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          {/* TAB 2: CONTROLLER DELEGATION */}
          {activeTab === 'controllers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Assign User as Controller</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="User ID or username"
                    value={newControllerUserId}
                    onChange={(e) => setNewControllerUserId(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup} style={{ width: 130 }}>
                  <label className={styles.label}>Role</label>
                  <select
                    className={styles.select}
                    value={newControllerRole}
                    onChange={(e) => setNewControllerRole(e.target.value as DelegatedRoomRole)}
                  >
                    <option value="HOST">Host</option>
                    <option value="MODERATOR">Moderator</option>
                  </select>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void handleAssignController()}
                  disabled={!newControllerUserId.trim() || isSubmitting}
                  style={{ height: 42 }}
                >
                  Assign
                </button>
              </div>

              <span className={styles.label}>Active Delegated Controllers</span>
              {loadingControllers ? (
                <div className={styles.emptyText}>Loading controllers...</div>
              ) : controllers.length === 0 ? (
                <div className={styles.emptyText}>No delegated controllers assigned yet.</div>
              ) : (
                <ul className={styles.itemList}>
                  {controllers.map((c) => (
                    <li key={c.userId} className={styles.itemCard}>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemTitle}>
                          {c.name || c.username || c.userId}
                        </span>
                        <span className={styles.itemSubtitle}>
                          Assigned {new Date(c.assignedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={styles.pillBadge}>{c.role}</span>
                        {isOwner && (
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => void handleRevokeController(c.userId)}
                            title="Revoke controller"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* TAB 3: OWNERSHIP TRANSFER */}
          {activeTab === 'transfer' && isOwner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                Transfer ownership of this room to another registered user. Once accepted, you will relinquish owner privileges.
              </p>

              {pendingTransferId ? (
                <div className={styles.itemCard}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemTitle}>Transfer Proposal Pending</span>
                    <span className={styles.itemSubtitle}>Waiting for recipient to accept</span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.dangerBtn}`}
                    onClick={() => void handleCancelTransfer()}
                    disabled={isSubmitting}
                  >
                    Cancel Proposal
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label className={styles.label}>New Owner User ID</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Recipient User ID"
                      value={transferRecipientId}
                      onChange={(e) => setTransferRecipientId(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void handleProposeTransfer()}
                    disabled={!transferRecipientId.trim() || isSubmitting}
                    style={{ height: 42 }}
                  >
                    Propose Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span className={styles.label}>Recent Management History</span>
              {loadingAudit ? (
                <div className={styles.emptyText}>Loading audit log...</div>
              ) : auditLogs.length === 0 ? (
                <div className={styles.emptyText}>No audit entries recorded yet.</div>
              ) : (
                <ul className={styles.itemList}>
                  {auditLogs.map((log) => (
                    <li key={log.id} className={styles.itemCard}>
                      <div className={styles.itemInfo}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={styles.pillBadge}>{log.action}</span>
                          <span className={styles.itemTitle}>{log.actorName || log.actorId}</span>
                        </div>
                        <span className={styles.itemSubtitle}>
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={isSubmitting || isLifecycleLoading}
          >
            Close
          </button>
          {activeTab === 'settings' && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleSaveSettings}
              disabled={isSubmitting || isLifecycleLoading}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save Settings'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoomSettingsModal;
