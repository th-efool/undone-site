'use client';

import React, { useState, useEffect } from 'react';
import { ACTIONS, PROGRESS_STEPS, SimulationResponse } from '@/src/lib/hackathon/data';
import {
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Zap,
  ShieldCheck,
  Check,
  Receipt,
  Copy,
  ExternalLink
} from 'lucide-react';

interface SimulatorTabProps {
  selectedAction: string;
  setSelectedAction: (key: string) => void;
  simStep: number;
  setSimStep: (step: number) => void;
  isLoading: boolean;
  simResult: SimulationResponse | null;
  handleTriggerSimulation: (key?: string) => Promise<void>;
  handleResetSim: () => void;
  handleRedeemNow: () => void;
}

export function SimulatorTab({
  selectedAction,
  setSelectedAction,
  simStep,
  setSimStep,
  isLoading,
  simResult,
  handleTriggerSimulation,
  handleResetSim,
  handleRedeemNow,
}: SimulatorTabProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [animStage, setAnimStage] = useState(0);

  // Animate verification checklist sequentially in Step 2
  useEffect(() => {
    if (simStep === 2) {
      setAnimStage(1);
      const t1 = setTimeout(() => setAnimStage(2), 250);
      const t2 = setTimeout(() => setAnimStage(3), 500);
      const t3 = setTimeout(() => setAnimStage(4), 800);
      const t4 = setTimeout(() => setAnimStage(5), 1100);
      const tEnd = setTimeout(() => {
        setSimStep(3);
      }, 1400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(tEnd);
      };
    } else {
      setAnimStage(0);
    }
  }, [simStep, setSimStep]);

  const selectedActionObj = ACTIONS.find((a) => a.key === selectedAction) || ACTIONS[0];

  return (
    <div className="space-y-8">
      {/* ── 1. The Four Workflow Phases (Compact Stepper ~72px) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
        {PROGRESS_STEPS.map((st) => {
          const isActive = simStep === st.step;
          const isCompleted = simStep > st.step;
          const isQueued = simStep < st.step;

          return (
            <div
              key={st.step}
              className={`phase-step ${isActive ? 'active' : isCompleted ? 'completed' : 'queued'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`phase-number ${
                    isActive ? 'active' : isCompleted ? 'completed' : 'queued'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 text-[#05070b]" /> : st.step}
                </span>

                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: isActive ? '#f5f7fb' : isCompleted ? '#00d89a' : '#647187',
                  }}
                >
                  {isActive ? 'ACTIVE' : isCompleted ? 'COMPLETED' : 'QUEUED'}
                </span>
              </div>

              <div>
                <h4
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isActive ? '#f5f7fb' : isCompleted ? '#f5f7fb' : '#9aa7bb',
                  }}
                  className="tracking-tight"
                >
                  {st.title}
                </h4>
                <p
                  style={{
                    fontSize: '11px',
                    color: isActive ? '#9aa7bb' : '#647187',
                    marginTop: '1px',
                  }}
                  className="hidden sm:block truncate"
                >
                  {st.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── PHASE 1: SELECT MILESTONE ── */}
      {simStep === 1 && (
        <div>
          {/* Header Area */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#9aa7bb',
                textTransform: 'uppercase',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap className="w-3.5 h-3.5 text-[#00d89a]" />
              <span>PHASE 01: SELECT MILESTONE</span>
            </div>

            <h2
              className="hero-title"
              style={{
                fontSize: '40px',
                lineHeight: 1.08,
                letterSpacing: '-0.035em',
                fontWeight: 700,
                color: '#f5f7fb',
                maxWidth: '680px',
              }}
            >
              Simulate a User Milestone<br />in SideQuestHQ
            </h2>

            <p
              className="hero-description"
              style={{
                maxWidth: '720px',
                color: '#9aa7bb',
                fontSize: '15px',
                lineHeight: 1.6,
                marginTop: '10px',
              }}
            >
              Choose an action below to dispatch a verification payload to the BuildBank rules engine.
              Our sub-250ms pipeline validates proof-of-work, checks sybil prevention, and releases sponsored brand credit.
            </p>
          </div>

          {/* Action Grid (2 Columns >= 800px, 1 Column < 800px) */}
          <div role="radiogroup" aria-label="Select an action to simulate" className="action-grid">
            {ACTIONS.map((act) => {
              const isSelected = selectedAction === act.key;
              return (
                <div
                  key={act.key}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedAction(act.key)}
                  className={`cohort-card ${isSelected ? 'selected' : ''}`}
                >
                  {/* Left: Real Explore Thumbnail */}
                  <img
                    src={act.thumbnail}
                    alt={act.title}
                    className="cohort-card-thumb"
                  />

                  {/* Right: Info & Controls */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                    <div>
                      {/* Top row: Sponsored Cohort label + 20px Radio Indicator */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            color: '#647187',
                            textTransform: 'uppercase',
                          }}
                        >
                          [{act.category}]
                        </span>

                        {/* 20px Radio Circle Indicator */}
                        <div
                          className={`cohort-radio ${isSelected ? 'selected' : ''}`}
                          aria-hidden="true"
                        >
                          {isSelected && (
                            <span style={{ fontSize: '10px', lineHeight: 1 }}>●</span>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <h3
                        style={{
                          fontSize: '18px',
                          lineHeight: 1.25,
                          fontWeight: 700,
                          color: '#f5f7fb',
                          marginTop: '4px',
                        }}
                      >
                        {act.title}
                      </h3>

                      {/* Description */}
                      <p
                        style={{
                          fontSize: '13px',
                          lineHeight: 1.45,
                          color: '#9aa7bb',
                          marginTop: '4px',
                        }}
                      >
                        {act.desc}
                      </p>
                    </div>

                    {/* Bottom Row: Sponsor Unlock + Select Button */}
                    <div className="pt-3 mt-3 border-t border-[#1c2738] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span style={{ fontSize: '12px', color: '#647187' }} className="hidden sm:inline">
                          Sponsor unlock:
                        </span>
                        <span className="reward-pill truncate">{act.expectedReward}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAction(act.key);
                        }}
                        className={`select-action ${isSelected ? 'selected' : ''}`}
                      >
                        <span>{isSelected ? 'Selected ✓' : 'Select →'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dedicated Verification Action Area */}
          <div className="verification-action flex-col sm:flex-row gap-4">
            {/* Left side: Selected Milestone Summary */}
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#647187',
                  display: 'block',
                }}
              >
                SELECTED MILESTONE
              </span>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#f5f7fb',
                  marginTop: '2px',
                }}
              >
                {selectedActionObj.title}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#9aa7bb',
                  marginTop: '1px',
                }}
              >
                {selectedActionObj.desc}
              </div>
            </div>

            {/* Right side: Verification CTA (Sole Primary Button) */}
            <button
              type="button"
              onClick={() => handleTriggerSimulation(selectedAction)}
              disabled={!selectedAction || isLoading}
              className="verify-button w-full sm:w-auto"
            >
              <span>Verify "{selectedActionObj.title}" →</span>
            </button>
          </div>

          {/* Quiet Status Bar */}
          <div className="status-bar">
            <div className="flex items-center gap-2">
              <span className="online-dot" />
              <span className="status-online">ONLINE</span>
              <span style={{ color: '#1c2738', margin: '0 4px' }}>|</span>
              <span>
                Verification target <strong style={{ color: '#f5f7fb', fontWeight: 600 }}>&lt;250ms</strong>
              </span>
            </div>

            <div style={{ color: '#647187', fontSize: '11px' }}>
              Rules Engine v1.4
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 2: VERIFICATION PIPELINE (ANIMATED TRANSITION) ── */}
      {simStep === 2 && (
        <div
          style={{
            background: '#0b101a',
            border: '1px solid #1c2738',
            borderRadius: '12px',
            padding: '32px 24px',
            maxWidth: '680px',
            margin: '0 auto',
          }}
          className="space-y-6"
        >
          <div className="text-center space-y-2">
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                color: '#9aa7bb',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              PHASE 02: VERIFYING MILESTONE
            </span>
            <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#f5f7fb' }}>
              Autonomous Verification Pipeline
            </h3>
            <p style={{ fontSize: '14px', color: '#9aa7bb' }}>
              Evaluating proof for <strong style={{ color: '#f5f7fb' }}>"{selectedActionObj.title}"</strong>
            </p>
          </div>

          {/* Checklist rows */}
          <div
            style={{
              background: '#05070b',
              border: '1px solid #1c2738',
              borderRadius: '8px',
              padding: '16px',
            }}
            className="space-y-3 font-mono text-xs"
          >
            <div
              className="flex items-center justify-between"
              style={{ color: animStage >= 1 ? '#00d89a' : '#647187' }}
            >
              <span className="flex items-center gap-2">
                <span>{animStage >= 1 ? '✓' : '○'}</span>
                <span>Payload received from SideQuestHQ</span>
              </span>
              <span>{animStage >= 1 ? '12ms' : '...'}</span>
            </div>

            <div
              className="flex items-center justify-between"
              style={{ color: animStage >= 2 ? '#00d89a' : '#647187' }}
            >
              <span className="flex items-center gap-2">
                <span>{animStage >= 2 ? '✓' : '○'}</span>
                <span>Proof-of-work validated</span>
              </span>
              <span>{animStage >= 2 ? '64ms' : '...'}</span>
            </div>

            <div
              className="flex items-center justify-between"
              style={{ color: animStage >= 3 ? '#00d89a' : '#647187' }}
            >
              <span className="flex items-center gap-2">
                <span>{animStage >= 3 ? '✓' : '○'}</span>
                <span>Sybil check passed (Score: 99.4%)</span>
              </span>
              <span>{animStage >= 3 ? '145ms' : '...'}</span>
            </div>

            <div
              className="flex items-center justify-between"
              style={{ color: animStage >= 4 ? '#00d89a' : '#647187' }}
            >
              <span className="flex items-center gap-2">
                <span>{animStage >= 4 ? '✓' : '○'}</span>
                <span>Sponsor reward settlement</span>
              </span>
              <span>{animStage >= 4 ? '195ms' : '...'}</span>
            </div>

            <div
              className="flex items-center justify-between"
              style={{ color: animStage >= 5 ? '#00d89a' : '#647187' }}
            >
              <span className="flex items-center gap-2">
                <span>{animStage >= 5 ? '✓' : '○'}</span>
                <span>Instant redemption ready</span>
              </span>
              <span>{animStage >= 5 ? '210ms' : '...'}</span>
            </div>
          </div>

          <div className="text-center" style={{ fontSize: '12px', color: '#9aa7bb', fontWeight: 600 }}>
            Verifying in under 250ms...
          </div>
        </div>
      )}

      {/* ── PHASE 3: FINANCIAL REWARD UNLOCKED ── */}
      {simStep === 3 && simResult && (
        <div className="space-y-6">
          {/* Header row */}
          <div
            style={{
              background: '#0b101a',
              border: '1px solid #1c2738',
              borderRadius: '12px',
              padding: '20px',
            }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#00d89a',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                PHASE 03: MILESTONE VERIFIED
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#f5f7fb', marginTop: '2px' }}>
                Sponsor Reward Unlocked in {simResult.metrics.latencyMs}ms
              </h3>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetSim}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  background: '#111522',
                  border: '1px solid #1c2738',
                  color: '#9aa7bb',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                className="cursor-pointer hover:text-white hover:bg-[#1c2738] flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleRedeemNow}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '6px',
                  background: '#00d89a',
                  border: '1px solid #00d89a',
                  color: '#05070b',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
                className="cursor-pointer hover:bg-[#00f5ae] flex items-center gap-1.5 transition-all shadow-md active:scale-98"
              >
                <span>Instant Redemption</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2-Column: Voucher on Left, Audit Telemetry on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Digital Voucher */}
            <div
              style={{
                background: '#0e1420',
                border: '1px solid #303b52',
                borderRadius: '12px',
                padding: '28px',
              }}
              className="lg:col-span-7 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '8px',
                        background: '#111522',
                        border: '1px solid #1c2738',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                      }}
                    >
                      {simResult.reward.logo}
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          color: '#9aa7bb',
                          textTransform: 'uppercase',
                        }}
                      >
                        {simResult.reward.partnerCategory}
                      </span>
                      <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#f5f7fb' }}>
                        {simResult.reward.partnerName}
                      </h4>
                    </div>
                  </div>

                  <span className="reward-pill">{simResult.reward.rewardValue}</span>
                </div>

                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#f5f7fb', lineHeight: 1.2 }}>
                    {simResult.reward.rewardHeadline}
                  </h2>
                  <p style={{ fontSize: '14px', color: '#9aa7bb', marginTop: '6px' }}>
                    {simResult.reward.terms}
                  </p>
                </div>
              </div>

              {/* Single Use Code */}
              <div
                style={{
                  background: '#05070b',
                  border: '1px solid #1c2738',
                  borderRadius: '8px',
                  padding: '14px 16px',
                }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div>
                  <span style={{ fontSize: '10px', color: '#647187', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                    Single-Use Verification Code
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#f5f7fb', fontFamily: 'monospace' }}>
                    {simResult.reward.code}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(simResult.reward.code);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    background: '#111522',
                    border: '1px solid #303b52',
                    color: '#f5f7fb',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  className="cursor-pointer hover:bg-[#1c2738] flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-[#00d89a]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>
            </div>

            {/* Telemetry Audit */}
            <div
              style={{
                background: '#0b101a',
                border: '1px solid #1c2738',
                borderRadius: '12px',
                padding: '24px',
              }}
              className="lg:col-span-5 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#1c2738] pb-3">
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f5f7fb', fontFamily: 'monospace' }}>
                    AUDIT TELEMETRY
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#00d89a',
                      background: '#062d24',
                      border: '1px solid #08745b',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}
                  >
                    200 OK
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between py-1 border-b border-[#1c2738]">
                    <span style={{ color: '#647187' }}>ENGINE STATUS</span>
                    <span style={{ color: '#00d89a', fontWeight: 600 }}>{simResult.status}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1c2738]">
                    <span style={{ color: '#647187' }}>PIPELINE LATENCY</span>
                    <span style={{ color: '#00d89a' }}>{simResult.metrics.latencyMs}ms</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1c2738]">
                    <span style={{ color: '#647187' }}>CONFIDENCE SCORE</span>
                    <span style={{ color: '#f5f7fb' }}>
                      {(simResult.action.evaluatedCriteria.confidenceScore * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#1c2738]">
                    <span style={{ color: '#647187' }}>ANTI-FRAUD VERDICT</span>
                    <span style={{ color: '#00d89a' }}>PASSED</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span style={{ color: '#647187' }}>VERIFICATION ID</span>
                    <span style={{ color: '#9aa7bb' }} className="truncate max-w-[140px]">
                      {simResult.verificationId}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#647187', borderTop: '1px solid #1c2738', paddingTop: '12px' }}>
                Verified via BuildBank Edge Rules Engine
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 4: INSTANT REDEMPTION ── */}
      {simStep === 4 && simResult && (
        <div
          style={{
            background: '#0b101a',
            border: '1px solid #1c2738',
            borderRadius: '12px',
            padding: '40px 24px',
            maxWidth: '640px',
            margin: '0 auto',
          }}
          className="text-center space-y-6 animate-in zoom-in-95 duration-200"
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#062d24',
              border: '1px solid #08745b',
              color: '#00d89a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <Check className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                color: '#00d89a',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              PHASE 04: INSTANT REDEMPTION
            </span>
            <h3 style={{ fontSize: '26px', fontWeight: 700, color: '#f5f7fb' }}>
              Instant Settlement Complete
            </h3>
            <p style={{ fontSize: '14px', color: '#9aa7bb', maxWidth: '440px', margin: '0 auto' }}>
              The benefit was applied programmatically inside SideQuestHQ without off-platform redirects.
            </p>
          </div>

          {/* Checkout Reconciliation Box */}
          <div
            style={{
              background: '#05070b',
              border: '1px solid #1c2738',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '380px',
              margin: '0 auto',
            }}
            className="text-left font-mono text-xs space-y-3"
          >
            <div className="flex justify-between text-[#9aa7bb]">
              <span>Standard Cost</span>
              <span>₹1,999.00</span>
            </div>

            <div className="flex justify-between text-[#00d89a] font-bold">
              <span>Sponsor Credit</span>
              <span>- {simResult.reward.rewardValue}</span>
            </div>

            <div
              style={{
                borderTop: '1px solid #1c2738',
                paddingTop: '8px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#f5f7fb',
              }}
              className="flex justify-between"
            >
              <span>Total Billed</span>
              <span style={{ color: '#00d89a' }}>
                ₹{Math.max(0, 1999 - simResult.reward.numericValue)}.00
              </span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleResetSim}
              style={{
                height: '42px',
                padding: '0 20px',
                borderRadius: '8px',
                background: '#00d89a',
                border: '1px solid #00d89a',
                color: '#05070b',
                fontSize: '13px',
                fontWeight: 700,
              }}
              className="cursor-pointer hover:bg-[#00f5ae] inline-flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Run Another Verification</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
