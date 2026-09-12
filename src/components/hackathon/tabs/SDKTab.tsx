'use client';

import React, { useState, useRef } from 'react';
import {
  Code2,
  Copy,
  Check,
  Zap,
  Shield,
  Layers,
  ArrowRight,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Key,
  RefreshCw,
  Send,
  Webhook,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RotateCcw,
  FileCode,
  Sliders,
  Eye,
  CheckCircle,
  XCircle,
} from 'lucide-react';

type SubNavTab = 'quickstart' | 'overview' | 'events' | 'reference' | 'webhooks' | 'security';
type RuntimeLang = 'react' | 'next' | 'node' | 'rest';
type SyntaxLang = 'typescript' | 'javascript';
type ActiveFile = 'milestone.tsx' | '.env.local' | 'package.json';
type TestOutcome = 'success' | 'rejected' | 'duplicate' | 'delayed';
type InspectorTab = 'request' | 'response' | 'schema';

interface Token {
  text: string;
  className: string;
}

// Token-level syntax parser for code highlighting
function tokenizeLine(line: string): Token[] {
  if (!line) return [{ text: ' ', className: '' }];
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return [{ text: line, className: 'code-comment' }];
  }

  const tokens: Token[] = [];
  const tokenRegex = /(\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:import|from|export|default|const|let|var|await|async|function|return|new|if|else|try|catch|require|curl)\b|\b(?:BuildBank|BuildBankClient|Request|Response|string|number|boolean|Promise|void|any)\b|[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()|[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*:)|`|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\b\d+\b|===|==|=>|&&|\|\||[=+\-*/<>!\\$]|[{}(\)\[\],;:.]|\.)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.substring(lastIndex, match.index), className: '' });
    }
    const val = match[0];
    let cls = '';
    if (val.startsWith('//') || val.startsWith('#')) cls = 'code-comment';
    else if (val.startsWith('"') || val.startsWith("'") || val.startsWith('`')) cls = 'code-string';
    else if (/^(import|from|export|default|const|let|var|await|async|function|return|new|if|else|try|catch|require|curl)$/.test(val)) cls = 'code-keyword';
    else if (/^(BuildBank|BuildBankClient|Request|Response|string|number|boolean|Promise|void|any)$/.test(val)) cls = 'code-type';
    else if (/^\d+$/.test(val)) cls = 'code-number';
    else if (/^[{}(\)\[\],;:.]$/.test(val)) cls = 'code-punctuation';
    else if (/^(===|==|=>|&&|\|\||[=+\-*/<>!\\$])$/.test(val)) cls = 'code-operator';
    else if (line[match.index + val.length] === '(' || line.substring(match.index + val.length).trim().startsWith('(')) cls = 'code-function';
    else if (line[match.index + val.length] === ':' || line.substring(match.index + val.length).trim().startsWith(':')) cls = 'code-property';
    else if (match.index > 0 && line[match.index - 1] === '.') cls = 'code-property';
    else cls = 'code-variable';

    tokens.push({ text: val, className: cls });
    lastIndex = tokenRegex.lastIndex;
  }
  if (lastIndex < line.length) {
    tokens.push({ text: line.substring(lastIndex), className: '' });
  }
  return tokens;
}

export function SDKTab() {
  const [environment, setEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [activeSubnav, setActiveSubnav] = useState<SubNavTab>('quickstart');
  const [activeRuntime, setActiveRuntime] = useState<RuntimeLang>('react');
  const [syntaxLang, setSyntaxLang] = useState<SyntaxLang>('typescript');
  const [activeFile, setActiveFile] = useState<ActiveFile>('milestone.tsx');
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLine, setCopiedLine] = useState<string | null>(null);

  // Quick Start Simulator State
  const [testOutcome, setTestOutcome] = useState<TestOutcome>('success');
  const [cohortId, setCohortId] = useState('reader-14-day');
  const [milestone, setMilestone] = useState('chapter_14_complete');
  const [userId, setUserId] = useState('user_48291');
  const [completion, setCompletion] = useState('100');
  const [streak, setStreak] = useState('14');
  const [score, setScore] = useState('98');
  const [idempotencyKey, setIdempotencyKey] = useState('reader:user_48291:chapter_14');
  const [requestId, setRequestId] = useState('req_01J9A8D7F3K2M5P');
  const [verificationId, setVerificationId] = useState('ver_01J8A49D7E8B1C2D3');
  const [copiedRequestId, setCopiedRequestId] = useState(false);
  const [copiedVerId, setCopiedVerId] = useState(false);

  // Event Lifecycle Animation State
  const [isSending, setIsSending] = useState(false);
  const [lifecycleStep, setLifecycleStep] = useState(6); // 1 to 6
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('response');
  const [headersOpen, setHeadersOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  // Selected API Reference endpoint
  const [selectedEndpoint, setSelectedEndpoint] = useState('POST /v1/milestones/verify');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
    'POST /v1/milestones/verify': true,
  });

  // Selected Event type in Events tab
  const [selectedEvent, setSelectedEvent] = useState('milestone.verified');

  // Webhook Test State
  const [webhookSent, setWebhookSent] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://app.example.com/api/buildbank/webhook');

  // Security rotation state
  const [keyRotated, setKeyRotated] = useState(false);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);
  const [copiedPubKey, setCopiedPubKey] = useState(false);

  // Ref to simulator for Run Example smooth focus
  const simulatorRef = useRef<HTMLDivElement>(null);

  const handleSendTestEvent = (forcedOutcome?: TestOutcome) => {
    const outcome = forcedOutcome || testOutcome;
    setIsSending(true);
    setLifecycleStep(1);
    const newReqId = `req_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
    const newVerId = `ver_${Math.random().toString(36).slice(2, 9)}`;
    setRequestId(newReqId);
    setVerificationId(newVerId);

    setTimeout(() => setLifecycleStep(2), 120);
    setTimeout(() => setLifecycleStep(3), 240);
    setTimeout(() => setLifecycleStep(4), 360);
    setTimeout(() => setLifecycleStep(5), 480);
    setTimeout(() => {
      setLifecycleStep(6);
      setIsSending(false);
      setInspectorTab('response');
    }, 600);
  };

  const handleReplayEvent = () => {
    setTestOutcome('duplicate');
    handleSendTestEvent('duplicate');
  };

  const handleGenerateNewKey = () => {
    const newKey = `reader:user_48291:ch14_${Math.random().toString(36).slice(2, 7)}`;
    setIdempotencyKey(newKey);
    setTestOutcome('success');
  };

  const handleRunExample = () => {
    setCohortId('reader-14-day');
    setMilestone('chapter_14_complete');
    setUserId('user_48291');
    setCompletion('100');
    setStreak('14');
    setScore('98');
    setIdempotencyKey('reader:user_48291:chapter_14');
    setTestOutcome('success');

    if (simulatorRef.current) {
      simulatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      simulatorRef.current.style.outline = '2px solid #6d5dfc';
      setTimeout(() => {
        if (simulatorRef.current) simulatorRef.current.style.outline = 'none';
      }, 1200);
    }
  };

  // Code samples generator
  const getActiveCodeContent = (): string => {
    if (activeFile === '.env.local') {
      return `# BuildBank API Credentials (${environment.toUpperCase()})
NEXT_PUBLIC_BUILDBANK_KEY=pk_${environment}_98f2a1b4c7d9e3f1a0b5c6d7
BUILDBANK_SECRET_KEY=sk_${environment}_42e9a8f7c1b3d5e2f6a8c0d1
BUILDBANK_ENVIRONMENT=${environment}
BUILDBANK_WEBHOOK_SECRET=whsec_88f912a3d4e5c6b7`;
    }

    if (activeFile === 'package.json') {
      return `{
  "name": "milestone-rewards-app",
  "version": "1.4.0",
  "private": true,
  "dependencies": {
    "@buildbank/embedded-rewards": "^1.4.0",
    "@buildbank/node": "^1.4.0",
    "next": "^14.2.0",
    "react": "^18.3.0"
  }
}`;
    }

    // milestone.tsx
    if (isDiffMode) {
      return `- // Legacy unverified client action
- await api.completeMilestone({ milestone: "${milestone}" });
+ import { BuildBank } from "@buildbank/embedded-rewards";
+
+ const buildBank = new BuildBank({
+   publishableKey: process.env.NEXT_PUBLIC_BUILDBANK_KEY${syntaxLang === 'typescript' ? '!' : ''},
+   environment: "${environment}",
+ });
+
+ // Trigger verification upon verified user action
+ const result = await buildBank.milestones.verify({
+   cohortId: "${cohortId}",
+   milestone: "${milestone}",
+   user: { externalId: "${userId}" },
+   proof: { streakDays: ${streak}, completionPercent: ${completion}, scorePercent: ${score} },
+   idempotencyKey: "${idempotencyKey}",
+ });
+
+ if (result.status === "verified") {
+   console.log("Sponsor Reward:", result.reward.code);
+ }`;
    }

    if (activeRuntime === 'react') {
      if (syntaxLang === 'typescript') {
        return `import { BuildBank } from "@buildbank/embedded-rewards";

const buildBank = new BuildBank({
  publishableKey: process.env.NEXT_PUBLIC_BUILDBANK_KEY!,
  environment: "${environment}",
});

// Trigger verification upon verified user action
const result = await buildBank.milestones.verify({
  cohortId: "${cohortId}",
  milestone: "${milestone}",

  user: {
    externalId: "${userId}",
  },

  proof: {
    streakDays: ${streak},
    completionPercent: ${completion},
    scorePercent: ${score},
  },

  idempotencyKey: "${idempotencyKey}",
});

if (result.status === "verified") {
  console.log("Sponsor Reward:", result.reward.code);
}`;
      }
      return `import { BuildBank } from "@buildbank/embedded-rewards";

const buildBank = new BuildBank({
  publishableKey: process.env.NEXT_PUBLIC_BUILDBANK_KEY,
  environment: "${environment}",
});

// Trigger verification upon verified user action
const result = await buildBank.milestones.verify({
  cohortId: "${cohortId}",
  milestone: "${milestone}",

  user: {
    externalId: "${userId}",
  },

  proof: {
    streakDays: ${streak},
    completionPercent: ${completion},
    scorePercent: ${score},
  },

  idempotencyKey: "${idempotencyKey}",
});

if (result.status === "verified") {
  console.log("Sponsor Reward:", result.reward.code);
}`;
    }

    if (activeRuntime === 'next') {
      if (syntaxLang === 'typescript') {
        return `// app/api/milestone/route.ts (Server Route Handler)
import { BuildBankClient } from "@buildbank/node";
import { auth } from "@/lib/auth";

const buildBank = new BuildBankClient({
  secretKey: process.env.BUILDBANK_SECRET_KEY!,
  environment: "${environment}",
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const verification = await buildBank.milestones.verify({
    cohortId: "${cohortId}",
    milestone: "${milestone}",
    user: { externalId: session.user.id },
    proof: { streakDays: ${streak}, completionPercent: ${completion}, scorePercent: ${score} },
    idempotencyKey: \`\${session.user.id}:${cohortId}:${milestone}\`,
  });

  return Response.json(verification);
}`;
      }
      return `// app/api/milestone/route.js (Server Route Handler)
import { BuildBankClient } from "@buildbank/node";
import { auth } from "@/lib/auth";

const buildBank = new BuildBankClient({
  secretKey: process.env.BUILDBANK_SECRET_KEY,
  environment: "${environment}",
});

export async function POST(req) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const verification = await buildBank.milestones.verify({
    cohortId: "${cohortId}",
    milestone: "${milestone}",
    user: { externalId: session.user.id },
    proof: { streakDays: ${streak}, completionPercent: ${completion}, scorePercent: ${score} },
    idempotencyKey: \`\${session.user.id}:${cohortId}:${milestone}\`,
  });

  return Response.json(verification);
}`;
    }

    if (activeRuntime === 'node') {
      if (syntaxLang === 'typescript') {
        return `// server.ts (Express Backend)
import express, { Request, Response } from "express";
import { BuildBankClient } from "@buildbank/node";

const app = express();
const bb = new BuildBankClient({
  secretKey: process.env.BUILDBANK_SECRET_KEY!,
  environment: "${environment}"
});

app.post("/api/verify-milestone", async (req: Request, res: Response) => {
  try {
    const response = await bb.milestones.verify({
      cohortId: req.body.cohortId,
      milestone: req.body.milestone,
      user: { externalId: req.body.userId },
      proof: req.body.proof,
      idempotencyKey: req.headers["idempotency-key"] as string
    });
    res.json(response);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.code });
  }
});`;
      }
      return `// server.js (Express Backend)
const express = require("express");
const { BuildBankClient } = require("@buildbank/node");

const app = express();
const bb = new BuildBankClient({
  secretKey: process.env.BUILDBANK_SECRET_KEY,
  environment: "${environment}"
});

app.post("/api/verify-milestone", async (req, res) => {
  try {
    const response = await bb.milestones.verify({
      cohortId: req.body.cohortId,
      milestone: req.body.milestone,
      user: { externalId: req.body.userId },
      proof: req.body.proof,
      idempotencyKey: req.headers["idempotency-key"]
    });
    res.json(response);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.code });
  }
});`;
    }

    // rest
    return `curl -X POST https://${environment === 'sandbox' ? 'sandbox.api' : 'api'}.buildbank.dev/v1/milestones/verify \\
  -H "Authorization: Bearer \${BUILDBANK_SECRET_KEY}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ${idempotencyKey}" \\
  -d '{
    "cohortId": "${cohortId}",
    "milestone": "${milestone}",
    "user": {
      "externalId": "${userId}"
    },
    "proof": {
      "streakDays": ${streak},
      "completionPercent": ${completion},
      "scorePercent": ${score}
    }
  }'`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getActiveCodeContent());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleCopyLine = (line: string) => {
    navigator.clipboard.writeText(line.replace(/^[+-]\s*/, ''));
    setCopiedLine(line);
    setTimeout(() => setCopiedLine(null), 1200);
  };

  const activeCodeLines = getActiveCodeContent().trim().split('\n');

  // Response simulation payload based on outcome
  const getSimulatedResponse = () => {
    if (testOutcome === 'duplicate') {
      return JSON.stringify(
        {
          error: {
            code: 'duplicate_event',
            status: 409,
            message: 'Event already verified for this idempotency key. Existing verification returned.',
            verificationId,
            reward: {
              code: 'SPONSOR-READER-500',
              status: 'previously_issued',
            },
          },
        },
        null,
        2
      );
    }
    if (testOutcome === 'rejected') {
      return JSON.stringify(
        {
          error: {
            code: 'verification_failed',
            status: 422,
            message: 'Milestone proof does not satisfy cohort threshold (requires streak >= 14).',
            sybilScore: 0.42,
            settlement: 'rejected',
          },
        },
        null,
        2
      );
    }
    if (testOutcome === 'delayed') {
      return JSON.stringify(
        {
          status: 'reward_authorized',
          statusCode: 202,
          verificationId,
          settlement: {
            status: 'pending_escrow_batch',
            webhookPending: true,
          },
        },
        null,
        2
      );
    }
    return JSON.stringify(
      {
        status: 'verified',
        verificationId,
        evaluatedAt: '2026-09-12T08:42:11.341Z',
        latencyMs: 155,
        sybilVerdict: 'passed',
        reward: {
          partner: 'Amazon Kindle & Audible',
          type: 'partner_credit',
          value: 500,
          currency: 'INR',
          code: 'SPONSOR-READER-500',
          expiresInMinutes: 60,
        },
        settlement: {
          status: 'authorized',
          escrowBatchId: 'esc_98471203',
        },
      },
      null,
      2
    );
  };

  const simulatedRequest = JSON.stringify(
    {
      cohortId,
      milestone,
      user: { externalId: userId },
      proof: {
        streakDays: Number(streak) || 0,
        completionPercent: Number(completion) || 0,
        scorePercent: Number(score) || 0,
      },
      idempotencyKey,
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      {/* ── 1. Hero & Metadata Section ── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#6d5dfc',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          [DEVELOPER INTEGRATION]
        </div>

        <h2 className="sdk-title">
          Embed BuildBank rewards into<br />any milestone-driven product.
        </h2>

        <p className="sdk-description">
          React / Next.js · REST API · Webhooks. Trigger verified milestones; BuildBank validates event proof-of-work and settles sponsor capital programmatically.
        </p>

        {/* ── Infrastructure Metadata Bar ── */}
        <div className="flex flex-wrap items-center gap-6 mt-4 pt-3 border-t border-[#1c2940]/60 text-xs font-mono">
          {/* Environment Switch */}
          <div className="flex items-center gap-2">
            <span style={{ color: '#64738c' }}>Environment:</span>
            <div className="environment-switch" style={{ marginTop: 0 }}>
              <button
                type="button"
                onClick={() => setEnvironment('sandbox')}
                className={environment === 'sandbox' ? 'active' : ''}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => setEnvironment('live')}
                className={environment === 'live' ? 'active' : ''}
              >
                Live
              </button>
            </div>
          </div>

          <div style={{ color: environment === 'live' ? '#00d89a' : '#74829a' }}>
            {environment === 'sandbox' ? (
              <span>Sandbox: Test events do not settle sponsor capital.</span>
            ) : (
              <span className="flex items-center gap-1.5 font-bold">
                <span className="online-dot" />
                Production environment · sponsor settlement enabled
              </span>
            )}
          </div>

          {/* SDK Version */}
          <div className="flex items-center gap-2">
            <span style={{ color: '#64738c' }}>SDK:</span>
            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>@buildbank/embedded-rewards v1.4.0</span>
            <span className="px-1.5 py-0.5 bg-[#062d24] border border-[#08745b] text-[#00d89a] rounded text-[10px] font-bold">
              Latest
            </span>
          </div>

          {/* API Version */}
          <div className="flex items-center gap-2">
            <span style={{ color: '#64738c' }}>API:</span>
            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>v1 · Current</span>
          </div>
        </div>
      </div>

      {/* ── 2. SDK Sub-navigation ── */}
      <div className="sdk-subnav">
        {[
          { id: 'quickstart', label: 'Quick Start' },
          { id: 'overview', label: 'Overview' },
          { id: 'events', label: 'Events' },
          { id: 'reference', label: 'API Reference' },
          { id: 'webhooks', label: 'Webhooks' },
          { id: 'security', label: 'Security' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubnav(tab.id as SubNavTab)}
            className={activeSubnav === tab.id ? 'active' : ''}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 3. TAB CONTENT: QUICK START ── */}
      {activeSubnav === 'quickstart' && (
        <div className="space-y-6">
          {/* Two-Column Developer Workspace */}
          <div className="sdk-workspace">
            {/* Left Column: Code Integration */}
            <div className="space-y-4">
              {/* File Tab Strip */}
              <div className="flex items-center justify-between border-b border-[#26334b] pb-2">
                <div className="flex items-center gap-1">
                  {[
                    { id: 'milestone.tsx', label: 'milestone.tsx' },
                    { id: '.env.local', label: '.env.local' },
                    { id: 'package.json', label: 'package.json' },
                  ].map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        setActiveFile(file.id as ActiveFile);
                        if (file.id !== 'milestone.tsx') setIsDiffMode(false);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 600,
                        background: activeFile === file.id ? '#171332' : 'transparent',
                        color: activeFile === file.id ? '#ffffff' : '#74829a',
                        border: activeFile === file.id ? '1px solid #6d5dfc' : '1px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {file.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunExample}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      background: '#6d5dfc',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #887cff',
                    }}
                    className="hover:bg-[#7b6cff] flex items-center gap-1 active:scale-98 transition-all"
                  >
                    <span>Run example →</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: 600,
                      color: copiedCode ? '#00d89a' : '#8fa0bb',
                      background: '#111a2d',
                      border: '1px solid #26334b',
                      cursor: 'pointer',
                    }}
                    className="hover:text-white flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-[#00d89a]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied ✓' : 'Copy code'}</span>
                  </button>
                </div>
              </div>

              {/* Language & Diff Controls Strip (Only for milestone.tsx) */}
              {activeFile === 'milestone.tsx' && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                  {/* Runtime Selector */}
                  <div className="flex items-center gap-1">
                    <span style={{ color: '#64738c', marginRight: '4px' }}>SDK:</span>
                    {(['react', 'next', 'node', 'rest'] as RuntimeLang[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setActiveRuntime(r)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: activeRuntime === r ? '#171332' : '#0b1120',
                          color: activeRuntime === r ? '#ffffff' : '#74829a',
                          border: activeRuntime === r ? '1px solid #6d5dfc' : '1px solid #1c2639',
                          cursor: 'pointer',
                        }}
                      >
                        {r === 'react' ? 'React' : r === 'next' ? 'Next.js' : r === 'node' ? 'Node.js' : 'REST'}
                      </button>
                    ))}
                  </div>

                  {/* Language Selector + Diff Switch */}
                  <div className="flex items-center gap-3">
                    {activeRuntime !== 'rest' && (
                      <div className="flex items-center gap-1">
                        <span style={{ color: '#64738c', marginRight: '4px' }}>Language:</span>
                        {(['typescript', 'javascript'] as SyntaxLang[]).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSyntaxLang(lang)}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: syntaxLang === lang ? '#111a2d' : 'transparent',
                              color: syntaxLang === lang ? '#cbd5e1' : '#64738c',
                              border: syntaxLang === lang ? '1px solid #354463' : '1px solid transparent',
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                            }}
                          >
                            {lang === 'typescript' ? 'TypeScript' : 'JavaScript'}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Diff Toggle */}
                    <div className="flex items-center gap-1 p-0.5 bg-[#0b1120] border border-[#26334b] rounded">
                      <button
                        type="button"
                        onClick={() => setIsDiffMode(false)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: !isDiffMode ? '#171332' : 'transparent',
                          color: !isDiffMode ? '#ffffff' : '#64738c',
                          fontWeight: !isDiffMode ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDiffMode(true)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: isDiffMode ? '#171332' : 'transparent',
                          color: isDiffMode ? '#ffffff' : '#64738c',
                          fontWeight: isDiffMode ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        Diff
                      </button>
                    </div>

                    {/* Diff Additions / Removals Indicator */}
                    {isDiffMode && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="additions font-bold">+ 8 additions</span>
                        <span className="removals font-bold">− 2 removals</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Code Editor with Line Ergonomics & Minimap */}
              <div
                style={{
                  border: '1px solid #26334b',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#070b14',
                }}
              >
                <div className="flex items-stretch">
                  {/* Code Editor Column */}
                  <div className="code-editor flex-grow">
                    {activeCodeLines.map((line, idx) => {
                      const isAdded = isDiffMode && line.startsWith('+');
                      const isRemoved = isDiffMode && line.startsWith('-');
                      const displayLine = line.replace(/^[+-]\s?/, '');
                      const tokens = tokenizeLine(isDiffMode ? line : displayLine);

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedLine(idx)}
                          className={`code-line ${selectedLine === idx ? 'selected' : ''} ${
                            isAdded ? 'diff-added' : ''
                          } ${isRemoved ? 'diff-removed' : ''}`}
                        >
                          <span className="code-line-num">{String(idx + 1).padStart(2, '0')}</span>
                          <span className="code-line-content">
                            {tokens.map((tok, tIdx) => (
                              <span key={tIdx} className={tok.className}>
                                {tok.text}
                              </span>
                            ))}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLine(line);
                            }}
                            className="line-copy-btn text-[10px] text-[#7e8ba6] hover:text-[#00d89a] ml-auto pr-2"
                            title="Copy line"
                          >
                            {copiedLine === line ? '✓' : 'copy'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Code Minimap */}
                  <div className="code-minimap hidden md:block">
                    {activeCodeLines.map((line, idx) => {
                      const isComment = line.trim().startsWith('//');
                      const isKey = line.includes('const') || line.includes('import') || line.includes('export');
                      const isProp = line.includes(':');
                      const color = isComment ? '#54647d' : isKey ? '#c792ea' : isProp ? '#89ddff' : '#cbd5e1';
                      const widthPercent = Math.min(100, Math.max(20, line.length * 2));
                      return (
                        <div
                          key={idx}
                          style={{
                            height: '3px',
                            marginBottom: '2px',
                            width: `${widthPercent}%`,
                            background: color,
                            borderRadius: '1px',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Verification Semantics */}
              <div className="sdk-card space-y-3">
                <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
                  WHAT BUILDBANK VERIFIES
                </div>
                <div className="space-y-2.5 font-mono text-xs">
                  {[
                    { num: '01', title: 'Event authenticity', desc: 'Signed request + platform credentials' },
                    { num: '02', title: 'Milestone proof', desc: 'Completion metadata against configured cohort criteria' },
                    { num: '03', title: 'Sybil resistance', desc: 'User / platform identity and replay protection' },
                    { num: '04', title: 'Idempotency', desc: 'Duplicate milestone submissions resolve to one verification' },
                    { num: '05', title: 'Sponsor eligibility', desc: 'Reward released only when campaign conditions are satisfied' },
                  ].map((row) => (
                    <div key={row.num} className="flex items-start gap-3 border-b border-[#1c2940]/60 pb-2">
                      <span style={{ color: '#6d5dfc', fontWeight: 700 }}>{row.num}</span>
                      <div>
                        <span style={{ color: '#f4f6fb', fontWeight: 600 }}>{row.title}</span>
                        <p style={{ color: '#8fa0bb', fontSize: '11px', marginTop: '1px' }}>{row.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Idempotency as First-Class Concept */}
              <div className="sdk-card space-y-2">
                <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
                  IDEMPOTENCY
                </div>
                <p style={{ fontSize: '13px', color: '#8fa0bb' }}>
                  Every milestone submission requires an idempotency key.
                </p>
                <div
                  style={{
                    background: '#070b14',
                    border: '1px solid #1c2639',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#6d5dfc',
                  }}
                >
                  reader:user_48291:chapter_14
                </div>
                <p style={{ fontSize: '12px', color: '#64738c' }}>
                  Repeated submissions return the existing verification instead of issuing a second reward.
                </p>
              </div>
            </div>

            {/* Right Column: Request Configuration & Simulator */}
            <div className="space-y-4" ref={simulatorRef}>
              <div className="config-panel space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#26334b] pb-2.5">
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f4f6fb', fontFamily: 'monospace' }}>
                    TEST EVENT SIMULATOR
                  </span>
                  <button
                    type="button"
                    onClick={handleRunExample}
                    style={{
                      fontSize: '11px',
                      color: '#a69cff',
                      fontFamily: 'monospace',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    className="hover:underline flex items-center gap-1"
                  >
                    <span>Use example payload →</span>
                  </button>
                </div>

                <div style={{ fontSize: '10px', color: '#64738c', fontFamily: 'monospace' }}>
                  REQUEST
                </div>

                {/* IDENTITY Group */}
                <div className="space-y-1">
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e8ba6', fontFamily: 'monospace' }}>
                    IDENTITY
                  </div>
                  <label style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace' }} className="block">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className={`config-input ${userId.trim() ? 'valid' : 'invalid'}`}
                  />
                  <div style={{ fontSize: '11px', color: '#5f6e86' }}>
                    Your platform's stable external user identifier.
                  </div>
                </div>

                {/* MILESTONE Group */}
                <div className="space-y-2 pt-1 border-t border-[#1c2940]/40">
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e8ba6', fontFamily: 'monospace' }}>
                    MILESTONE
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace' }} className="block mb-1">
                      Cohort
                    </label>
                    <input
                      type="text"
                      value={cohortId}
                      onChange={(e) => setCohortId(e.target.value)}
                      className="config-input"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace' }} className="block mb-1">
                      Milestone
                    </label>
                    <input
                      type="text"
                      value={milestone}
                      onChange={(e) => setMilestone(e.target.value)}
                      className="config-input"
                    />
                  </div>
                </div>

                {/* PROOF Group */}
                <div className="space-y-1 pt-1 border-t border-[#1c2940]/40">
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e8ba6', fontFamily: 'monospace' }}>
                    PROOF
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label style={{ fontSize: '10px', color: '#7e8ba6', fontFamily: 'monospace' }} className="block mb-1">
                        Completion %
                      </label>
                      <input
                        type="text"
                        value={completion}
                        onChange={(e) => setCompletion(e.target.value)}
                        className="config-input text-center"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: '#7e8ba6', fontFamily: 'monospace' }} className="block mb-1">
                        Streak Days
                      </label>
                      <input
                        type="text"
                        value={streak}
                        onChange={(e) => setStreak(e.target.value)}
                        className="config-input text-center"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: '#7e8ba6', fontFamily: 'monospace' }} className="block mb-1">
                        Score %
                      </label>
                      <input
                        type="text"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                        className="config-input text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* REPLAY PROTECTION Group */}
                <div className="space-y-1 pt-1 border-t border-[#1c2940]/40">
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e8ba6', fontFamily: 'monospace' }}>
                    REPLAY PROTECTION
                  </div>
                  <label style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace' }} className="block">
                    Idempotency Key
                  </label>
                  <input
                    type="text"
                    value={idempotencyKey}
                    onChange={(e) => setIdempotencyKey(e.target.value)}
                    className={`config-input text-xs ${idempotencyKey.trim() ? 'valid' : 'invalid'}`}
                  />
                  {!idempotencyKey.trim() ? (
                    <div style={{ fontSize: '11px', color: '#ef5350' }}>Idempotency key is required.</div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#5f6e86' }}>
                      Prevents duplicate settlement for the same milestone.
                    </div>
                  )}
                </div>

                {/* OUTCOME Group */}
                <div className="space-y-1 pt-1 border-t border-[#1c2940]/40">
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7e8ba6', fontFamily: 'monospace' }}>
                    OUTCOME
                  </div>
                  <select
                    value={testOutcome}
                    onChange={(e) => setTestOutcome(e.target.value as TestOutcome)}
                    className="config-input cursor-pointer"
                  >
                    <option value="success">Successful verification</option>
                    <option value="rejected">Verification rejected (422)</option>
                    <option value="duplicate">Duplicate event (409)</option>
                    <option value="delayed">Settlement delayed (202)</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSendTestEvent()}
                    disabled={isSending || !idempotencyKey.trim()}
                    style={{
                      width: '100%',
                      height: '40px',
                      borderRadius: '8px',
                      background: '#6d5dfc',
                      border: '1px solid #887cff',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                    className="hover:bg-[#7b6cff] flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Validating Lifecycle...' : 'Send Test Event →'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleReplayEvent}
                      disabled={isSending}
                      style={{
                        height: '32px',
                        borderRadius: '6px',
                        background: '#111a2d',
                        border: '1px solid #26334b',
                        color: '#cbd5e1',
                        fontSize: '11px',
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      className="hover:text-white flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3 text-[#f07178]" />
                      <span>Replay Event</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateNewKey}
                      style={{
                        height: '32px',
                        borderRadius: '6px',
                        background: '#111a2d',
                        border: '1px solid #26334b',
                        color: '#cbd5e1',
                        fontSize: '11px',
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      className="hover:text-white flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3 text-[#00d89a]" />
                      <span>New Key</span>
                    </button>
                  </div>
                </div>

                {/* Request & Verification Identifiers */}
                <div className="pt-2 border-t border-[#26334b] space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#64738c' }}>Request ID:</span>
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: '#a69cff' }}>{requestId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(requestId);
                          setCopiedRequestId(true);
                          setTimeout(() => setCopiedRequestId(false), 1200);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        className="text-[#7e8ba6] hover:text-white"
                        title="Copy Request ID"
                      >
                        {copiedRequestId ? <Check className="w-3 h-3 text-[#00d89a]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span style={{ color: '#64738c' }}>Verification ID:</span>
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: '#00d89a' }}>{verificationId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(verificationId);
                          setCopiedVerId(true);
                          setTimeout(() => setCopiedVerId(false), 1200);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        className="text-[#7e8ba6] hover:text-white"
                        title="Copy Verification ID"
                      >
                        {copiedVerId ? <Check className="w-3 h-3 text-[#00d89a]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Lifecycle Panel with Vertical Connecting Lines & Latency */}
              <div className="sdk-card space-y-3">
                <div className="flex items-center justify-between border-b border-[#26334b] pb-2">
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6' }}>
                    EVENT LIFECYCLE
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: isSending ? '#6d5dfc' : testOutcome === 'rejected' ? '#ef5350' : '#00d89a',
                    }}
                  >
                    {isSending ? 'PROCESSING' : testOutcome === 'rejected' ? 'REJECTED (422)' : 'SETTLED'}
                  </span>
                </div>

                {/* Vertical Timeline Nodes */}
                <div className="space-y-0 font-mono text-xs">
                  {[
                    { step: 1, name: 'event.received', time: '08:42:11.204', latency: '14ms' },
                    { step: 2, name: 'proof.validated', time: '08:42:11.249', latency: '45ms' },
                    { step: 3, name: 'sybil.check.passed', time: '08:42:11.261', latency: '12ms' },
                    { step: 4, name: 'milestone.verified', time: '08:42:11.273', latency: '12ms' },
                    { step: 5, name: 'reward.authorized', time: '08:42:11.280', latency: '7ms' },
                    { step: 6, name: 'settlement.completed', time: '08:42:11.288', latency: '8ms' },
                  ].map((row, idx, arr) => {
                    const isDone = lifecycleStep >= row.step;
                    const isCurrent = lifecycleStep === row.step && isSending;
                    const isLast = idx === arr.length - 1;

                    return (
                      <div key={row.name} className="relative flex items-start gap-3 py-1">
                        {/* Node & Connecting Line */}
                        <div className="flex flex-col items-center flex-shrink-0" style={{ width: '12px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: isCurrent ? '#6d5dfc' : isDone ? '#00d89a' : '#354158',
                              display: 'inline-block',
                              marginTop: '5px',
                              boxShadow: isCurrent ? '0 0 8px rgba(109, 93, 252, 0.8)' : 'none',
                            }}
                          />
                          {!isLast && (
                            <span
                              style={{
                                width: '2px',
                                height: '20px',
                                background: isDone ? '#17483e' : '#26334b',
                                display: 'block',
                                marginTop: '2px',
                              }}
                            />
                          )}
                        </div>

                        {/* Text & Latency Details */}
                        <div className="flex items-center justify-between w-full">
                          <span
                            style={{
                              color: isCurrent ? '#a69cff' : isDone ? '#e2e8f0' : '#64738c',
                              fontWeight: isDone ? 600 : 400,
                            }}
                          >
                            {row.name}
                          </span>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span style={{ color: '#64738c' }}>{row.time}</span>
                            <span style={{ color: isDone ? '#00d89a' : '#64738c', minWidth: '34px', textAlign: 'right' }}>
                              {row.latency}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Latency vs Target */}
                <div className="pt-2 border-t border-[#26334b] flex items-center justify-between text-xs font-mono">
                  <span style={{ color: '#7e8ba6' }}>Total verification latency:</span>
                  <span className="flex items-center gap-1.5">
                    <strong style={{ color: '#00d89a' }}>155ms</strong>
                    <span style={{ color: '#64738c' }}>/ &lt;250ms target</span>
                  </span>
                </div>
              </div>

              {/* API Endpoint Display with Status Badges */}
              <div className="sdk-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="post-badge">POST</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#f4f6fb', fontWeight: 600 }}>
                      /v1/milestones/verify
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: testOutcome === 'success' ? '#00d89a' : testOutcome === 'duplicate' ? '#ef5350' : '#ef5350',
                    }}
                  >
                    {testOutcome === 'success' ? '200 OK' : testOutcome === 'duplicate' ? '409 DUPLICATE' : '422 REJECTED'}
                  </span>
                </div>

                {/* Status Badges Row */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-[#062d24] text-[#00d89a] border border-[#08745b]">
                    200 Verified
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#111a2d] text-[#8fa0bb] border border-[#26334b]">
                    201 Authorized
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#111a2d] text-[#8fa0bb] border border-[#26334b]">
                    202 Delayed
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#111a2d] text-[#8fa0bb] border border-[#26334b]">
                    400 Invalid
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#111a2d] text-[#8fa0bb] border border-[#26334b]">
                    409 Duplicate
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#111a2d] text-[#8fa0bb] border border-[#26334b]">
                    422 Failed
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#111a2d] text-[#8fa0bb] border border-[#26334b]">
                    429 Limited
                  </span>
                </div>

                {/* Collapsible Request Headers */}
                <div className="pt-2 border-t border-[#26334b]">
                  <button
                    type="button"
                    onClick={() => setHeadersOpen(!headersOpen)}
                    className="flex items-center justify-between w-full text-xs font-mono text-[#8fa0bb] hover:text-white"
                  >
                    <span>Request Headers</span>
                    {headersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {headersOpen && (
                    <pre
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        background: '#070b14',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        color: '#a69cff',
                        marginTop: '6px',
                        lineHeight: 1.5,
                      }}
                    >
                      {`Authorization: Bearer sk_${environment}_••••••••\nContent-Type: application/json\nIdempotency-Key: ${idempotencyKey}\nX-BuildBank-Version: 2026-01`}
                    </pre>
                  )}
                </div>
              </div>

              {/* Request / Response / Schema Inspector */}
              <div className="sdk-card space-y-2">
                <div className="flex items-center justify-between border-b border-[#26334b] pb-2">
                  <div className="flex items-center gap-1.5">
                    {(['request', 'response', 'schema'] as InspectorTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setInspectorTab(tab)}
                        style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: inspectorTab === tab ? '#ffffff' : '#74829a',
                          background: inspectorTab === tab ? '#171332' : 'transparent',
                          border: inspectorTab === tab ? '1px solid #6d5dfc' : '1px solid transparent',
                          padding: '3px 9px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTraceOpen(!traceOpen)}
                    style={{
                      fontSize: '11px',
                      color: '#6d5dfc',
                      fontFamily: 'monospace',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    className="hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>{traceOpen ? 'Hide trace' : 'View verification trace →'}</span>
                  </button>
                </div>

                {/* Tab: Request */}
                {inspectorTab === 'request' && (
                  <pre
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      background: '#070b14',
                      padding: '10px',
                      borderRadius: '6px',
                      overflowX: 'auto',
                      color: '#cbd5e1',
                      maxHeight: '220px',
                      lineHeight: 1.5,
                    }}
                  >
                    <code>{simulatedRequest}</code>
                  </pre>
                )}

                {/* Tab: Response */}
                {inspectorTab === 'response' && (
                  <div className="space-y-2">
                    {/* Response Metadata Card */}
                    <div className="p-2.5 bg-[#070b14] border border-[#1c2639] rounded text-xs font-mono flex items-center justify-between">
                      <div>
                        <span style={{ color: '#64738c' }}>Outcome: </span>
                        <strong style={{ color: testOutcome === 'success' ? '#00d89a' : '#ef5350' }}>
                          {testOutcome === 'success' ? 'Verified · 155ms' : testOutcome === 'duplicate' ? '409 Duplicate' : '422 Failed'}
                        </strong>
                      </div>
                      <div style={{ color: '#8fa0bb' }}>
                        Reward: <span style={{ color: '#f4f6fb' }}>Amazon ₹500</span>
                      </div>
                    </div>

                    <pre
                      style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        background: '#070b14',
                        padding: '10px',
                        borderRadius: '6px',
                        overflowX: 'auto',
                        color: testOutcome !== 'success' ? '#ef5350' : '#00d89a',
                        maxHeight: '190px',
                        lineHeight: 1.5,
                      }}
                    >
                      <code>{getSimulatedResponse()}</code>
                    </pre>
                  </div>
                )}

                {/* Tab: Schema */}
                {inspectorTab === 'schema' && (
                  <div className="space-y-3 font-mono text-[11px] overflow-x-auto">
                    <div style={{ color: '#7e8ba6', fontWeight: 700 }}>REQUEST SCHEMA</div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#26334b] text-[#64738c]">
                          <th className="pb-1">FIELD</th>
                          <th className="pb-1">TYPE</th>
                          <th className="pb-1">REQ</th>
                          <th className="pb-1">DESCRIPTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1c2639]">
                        <tr>
                          <td className="py-1 text-[#89ddff]">cohortId</td>
                          <td className="py-1 text-[#ffcb6b]">string</td>
                          <td className="py-1 text-[#00d89a]">yes</td>
                          <td className="py-1 text-[#8fa0bb]">Sponsor cohort identifier</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-[#89ddff]">milestone</td>
                          <td className="py-1 text-[#ffcb6b]">string</td>
                          <td className="py-1 text-[#00d89a]">yes</td>
                          <td className="py-1 text-[#8fa0bb]">Action name to verify</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-[#89ddff]">user.externalId</td>
                          <td className="py-1 text-[#ffcb6b]">string</td>
                          <td className="py-1 text-[#00d89a]">yes</td>
                          <td className="py-1 text-[#8fa0bb]">Host user ID</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-[#89ddff]">proof.streakDays</td>
                          <td className="py-1 text-[#f78c6c]">integer</td>
                          <td className="py-1 text-[#00d89a]">yes</td>
                          <td className="py-1 text-[#8fa0bb]">Consecutive milestone days</td>
                        </tr>
                        <tr>
                          <td className="py-1 text-[#89ddff]">idempotencyKey</td>
                          <td className="py-1 text-[#ffcb6b]">string</td>
                          <td className="py-1 text-[#00d89a]">yes</td>
                          <td className="py-1 text-[#8fa0bb]">Replay protection key</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Verification Trace Drawer */}
                {traceOpen && (
                  <div className="mt-3 p-3 bg-[#070b14] border border-[#26334b] rounded-lg font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-[#1c2639] pb-1 text-[#7e8ba6] font-bold text-[11px]">
                      <span>VERIFICATION TRACE (10 STAGES)</span>
                      <span style={{ color: '#00d89a' }}>EXECUTION OK</span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {[
                        { step: '01', name: 'Request received', ms: '14ms', status: '200' },
                        { step: '02', name: 'Authentication (Bearer)', ms: '8ms', status: 'valid' },
                        { step: '03', name: 'Schema validation', ms: '11ms', status: 'valid' },
                        { step: '04', name: 'Cohort criteria lookup', ms: '18ms', status: 'active' },
                        { step: '05', name: 'Proof-of-work validation', ms: '45ms', status: 'passed' },
                        { step: '06', name: 'Identity & Sybil check', ms: '12ms', status: 'low_risk' },
                        { step: '07', name: 'Replay check (Idempotency)', ms: '9ms', status: 'new_event' },
                        { step: '08', name: 'Sponsor eligibility match', ms: '15ms', status: 'matched' },
                        { step: '09', name: 'Reward authorization', ms: '7ms', status: 'authorized' },
                        { step: '10', name: 'Settlement escrow release', ms: '8ms', status: 'completed' },
                      ].map((st) => (
                        <div key={st.step} className="flex items-center justify-between py-0.5 border-b border-[#1c2639]/40">
                          <span className="flex items-center gap-2">
                            <span style={{ color: '#6d5dfc', fontWeight: 700 }}>{st.step}</span>
                            <span style={{ color: '#cbd5e1' }}>{st.name}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span style={{ color: '#64738c' }}>{st.ms}</span>
                            <span style={{ color: '#00d89a' }}>{st.status}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Protocol Guarantees Infrastructure Strip */}
          <div className="protocol-guarantees">
            <div className="protocol-guarantee">
              <span style={{ color: '#7e8ba6', fontSize: '11px', fontFamily: 'monospace', display: 'block' }}>
                VERIFICATION LATENCY
              </span>
              <strong style={{ color: '#f4f6fb', fontSize: '14px', display: 'block', marginTop: '4px' }}>
                155ms observed
              </strong>
              <span style={{ color: '#00d89a', fontSize: '12px', fontFamily: 'monospace' }}>
                &lt;250ms target SLA
              </span>
            </div>

            <div className="protocol-guarantee">
              <span style={{ color: '#7e8ba6', fontSize: '11px', fontFamily: 'monospace', display: 'block' }}>
                REPLAY PROTECTION
              </span>
              <strong style={{ color: '#f4f6fb', fontSize: '14px', display: 'block', marginTop: '4px' }}>
                Idempotency enforced
              </strong>
              <span style={{ color: '#8fa0bb', fontSize: '12px', fontFamily: 'monospace' }}>
                Platform identity + key
              </span>
            </div>

            <div className="protocol-guarantee">
              <span style={{ color: '#7e8ba6', fontSize: '11px', fontFamily: 'monospace', display: 'block' }}>
                REWARD ABSTRACTION
              </span>
              <strong style={{ color: '#f4f6fb', fontSize: '14px', display: 'block', marginTop: '4px' }}>
                Unified sponsor contract
              </strong>
              <span style={{ color: '#a69cff', fontSize: '12px', fontFamily: 'monospace' }}>
                Programmatic escrow
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. TAB CONTENT: OVERVIEW ── */}
      {activeSubnav === 'overview' && (
        <div className="space-y-6">
          {/* Architecture Diagram */}
          <div className="sdk-card space-y-4">
            <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
              PROTOCOL ARCHITECTURE FLOW
            </div>
            <div
              style={{
                background: '#070b14',
                border: '1px solid #1c2639',
                borderRadius: '8px',
                padding: '20px',
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#cbd5e1',
                overflowX: 'auto',
              }}
            >
              <div>YOUR APP</div>
              <div style={{ color: '#6d5dfc' }}>│</div>
              <div style={{ color: '#6d5dfc' }}>│ milestone event payload</div>
              <div style={{ color: '#6d5dfc' }}>▼</div>
              <div style={{ color: '#f4f6fb', fontWeight: 700 }}>BUILDBANK SDK</div>
              <div style={{ color: '#6d5dfc' }}>│</div>
              <div style={{ color: '#6d5dfc' }}>│ signed verification request (sub-250ms)</div>
              <div style={{ color: '#6d5dfc' }}>▼</div>
              <div style={{ color: '#a69cff', fontWeight: 700 }}>RULES ENGINE (EDGE)</div>
              <div style={{ color: '#64738c' }}>├── proof validation</div>
              <div style={{ color: '#64738c' }}>├── sybil resistance checks</div>
              <div style={{ color: '#64738c' }}>├── cohort criteria evaluation</div>
              <div style={{ color: '#64738c' }}>└── idempotency cache</div>
              <div style={{ color: '#6d5dfc' }}>│</div>
              <div style={{ color: '#6d5dfc' }}>▼</div>
              <div style={{ color: '#00d89a', fontWeight: 700 }}>SPONSOR ESCROW ALLOCATION</div>
              <div style={{ color: '#64738c' }}>├── authorize voucher / credits</div>
              <div style={{ color: '#64738c' }}>├── settle programmatic deduction</div>
              <div style={{ color: '#64738c' }}>└── dispatch webhook confirmation</div>
              <div style={{ color: '#6d5dfc' }}>│</div>
              <div style={{ color: '#6d5dfc' }}>▼</div>
              <div style={{ color: '#f4f6fb', fontWeight: 700 }}>YOUR USER (INSTANT REDEMPTION)</div>
            </div>
          </div>

          {/* Integration Health Panel */}
          <div className="sdk-card space-y-3">
            <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
              INTEGRATION HEALTH
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-xs">
              <div className="p-3 bg-[#070b14] border border-[#1c2639] rounded-lg">
                <span style={{ color: '#64738c' }}>SDK</span>
                <div style={{ color: '#f4f6fb', fontWeight: 700, marginTop: '2px' }}>v1.4.0</div>
                <span style={{ color: '#00d89a', fontSize: '10px' }}>Connected</span>
              </div>
              <div className="p-3 bg-[#070b14] border border-[#1c2639] rounded-lg">
                <span style={{ color: '#64738c' }}>Environment</span>
                <div style={{ color: '#f4f6fb', fontWeight: 700, marginTop: '2px' }}>Sandbox</div>
                <span style={{ color: '#00d89a', fontSize: '10px' }}>Active</span>
              </div>
              <div className="p-3 bg-[#070b14] border border-[#1c2639] rounded-lg">
                <span style={{ color: '#64738c' }}>API</span>
                <div style={{ color: '#f4f6fb', fontWeight: 700, marginTop: '2px' }}>Operational</div>
                <span style={{ color: '#00d89a', fontSize: '10px' }}>&lt;250ms target</span>
              </div>
              <div className="p-3 bg-[#070b14] border border-[#1c2639] rounded-lg">
                <span style={{ color: '#64738c' }}>Webhook</span>
                <div style={{ color: '#f4f6fb', fontWeight: 700, marginTop: '2px' }}>Configured</div>
                <span style={{ color: '#a69cff', fontSize: '10px' }}>4 event types</span>
              </div>
              <div className="p-3 bg-[#070b14] border border-[#1c2639] rounded-lg">
                <span style={{ color: '#64738c' }}>Last test event</span>
                <div style={{ color: '#00d89a', fontWeight: 700, marginTop: '2px' }}>settled</div>
                <span style={{ color: '#64738c', fontSize: '10px' }}>08:42:11</span>
              </div>
            </div>
          </div>

          {/* Client vs Server Responsibilities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="sdk-card space-y-3">
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#6d5dfc', fontFamily: 'monospace' }}>
                CLIENT RESPONSIBILITIES
              </div>
              <ul className="space-y-2 text-xs text-[#8fa0bb]">
                <li className="flex items-center gap-2">
                  <span style={{ color: '#6d5dfc' }}>•</span>
                  <span>Display real-time reward and verification state</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#6d5dfc' }}>•</span>
                  <span>Collect user-facing milestone context</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#6d5dfc' }}>•</span>
                  <span>Initialize publishable SDK configuration</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#6d5dfc' }}>•</span>
                  <span>Render redemption voucher within host application</span>
                </li>
              </ul>
            </div>

            <div className="sdk-card space-y-3">
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#00d89a', fontFamily: 'monospace' }}>
                SERVER RESPONSIBILITIES
              </div>
              <ul className="space-y-2 text-xs text-[#8fa0bb]">
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00d89a' }}>•</span>
                  <span>Submit trusted milestone proof and user telemetry</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00d89a' }}>•</span>
                  <span>Store secret API credentials securely</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00d89a' }}>•</span>
                  <span>Verify HMAC-SHA256 signatures on inbound webhooks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span style={{ color: '#00d89a' }}>•</span>
                  <span>Handle redemption / financial settlement callbacks</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Latest SDK Change / Changelog Card */}
          <div className="sdk-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#26334b] pb-2">
              <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
                LATEST SDK CHANGE
              </div>
              <span style={{ fontSize: '11px', color: '#6d5dfc', fontFamily: 'monospace', cursor: 'pointer' }} className="hover:underline">
                View changelog →
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <div style={{ color: '#f4f6fb', fontWeight: 700 }}>v1.4.0 (Current)</div>
              <div style={{ color: '#00d89a' }}>+ Added milestone idempotency header enforcement</div>
              <div style={{ color: '#00d89a' }}>+ Added settlement webhook HMAC-SHA256 signatures</div>
              <div style={{ color: '#00d89a' }}>+ Added replay protection metadata in response payload</div>
              <div style={{ color: '#ef5350' }}>− Deprecated legacy reward.trigger() in favor of milestones.verify()</div>
            </div>
          </div>

          {/* Supported Runtimes */}
          <div className="sdk-card space-y-3">
            <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
              SUPPORTED RUNTIMES
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              {['React', 'Next.js', 'Node.js', 'REST API', 'Webhooks'].map((r) => (
                <span key={r} className="px-2.5 py-1 bg-[#111a2d] border border-[#26334b] text-[#f4f6fb] rounded">
                  {r}
                </span>
              ))}
              <span style={{ color: '#64738c', margin: '0 4px' }}>|</span>
              <span style={{ color: '#64738c' }}>COMING SOON:</span>
              {['Python', 'Ruby', 'Go'].map((r) => (
                <span key={r} className="px-2 py-0.5 bg-[#070b14] border border-[#1c2639] text-[#64738c] rounded text-[11px]">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. TAB CONTENT: EVENTS ── */}
      {activeSubnav === 'events' && (
        <div className="space-y-6">
          <div className="sdk-card space-y-3">
            <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
              PROTOCOL EVENT TYPES
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                {[
                  { name: 'milestone.completed', desc: 'Emitted when host application records completed milestone.' },
                  { name: 'milestone.verified', desc: 'Emitted after BuildBank validates submitted proof.' },
                  { name: 'reward.authorized', desc: 'Sponsor reward becomes eligible for settlement.' },
                  { name: 'settlement.completed', desc: 'Sponsor credit has been successfully allocated.' },
                  { name: 'verification.rejected', desc: 'Proof or eligibility criteria failed validation.' },
                ].map((ev) => (
                  <button
                    key={ev.name}
                    type="button"
                    onClick={() => setSelectedEvent(ev.name)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px',
                      borderRadius: '8px',
                      background: selectedEvent === ev.name ? '#171332' : '#070b14',
                      border: selectedEvent === ev.name ? '1px solid #6d5dfc' : '1px solid #1c2639',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: selectedEvent === ev.name ? '#a69cff' : '#f4f6fb' }}>
                      {ev.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8fa0bb', marginTop: '2px' }}>
                      {ev.desc}
                    </div>
                  </button>
                ))}
              </div>

              {/* Event Payload Inspector with Delivery Metadata */}
              <div className="p-4 bg-[#070b14] border border-[#1c2639] rounded-lg font-mono text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#1c2639] pb-2 text-[#7e8ba6]">
                  <span>PAYLOAD: {selectedEvent}</span>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#062d24] text-[#00d89a] border border-[#08745b] text-[10px]">
                      200 OK · 84ms
                    </span>
                    <span style={{ color: '#64738c', fontSize: '10px' }}>Attempt 1 / 3</span>
                  </div>
                </div>
                <pre style={{ color: '#cbd5e1', overflowX: 'auto', lineHeight: 1.5 }}>
                  {JSON.stringify(
                    {
                      id: 'evt_01J8A49D7E8B1C2D3',
                      event: selectedEvent,
                      createdAt: '2026-09-12T08:42:11.341Z',
                      data: {
                        verificationId: 'ver_01J8A49D7E8B1C2D3',
                        cohortId: 'reader-14-day',
                        milestone: 'chapter_14_complete',
                        userId: 'user_48291',
                        sponsorCreditInr: 500,
                        status: selectedEvent === 'verification.rejected' ? 'rejected' : 'verified',
                      },
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. TAB CONTENT: API REFERENCE ── */}
      {activeSubnav === 'reference' && (
        <div className="space-y-6">
          <div className="sdk-workspace">
            {/* Endpoints List with Accordion Groups */}
            <div className="sdk-card space-y-4">
              <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
                REST API ENDPOINTS
              </div>

              {/* Group 1: MILESTONES */}
              <div className="space-y-2">
                <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#64738c' }}>
                  MILESTONES
                </div>
                {[
                  { method: 'POST', path: '/v1/milestones/verify', desc: 'Verify user milestone & authorize reward' },
                  { method: 'GET', path: '/v1/milestones/{verificationId}', desc: 'Retrieve verification record' },
                ].map((ep) => {
                  const epKey = `${ep.method} ${ep.path}`;
                  const isSelected = selectedEndpoint === epKey;
                  return (
                    <button
                      key={epKey}
                      type="button"
                      onClick={() => {
                        setSelectedEndpoint(epKey);
                        setExpandedEndpoints((prev) => ({ ...prev, [epKey]: !prev[epKey] }));
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isSelected ? '#171332' : '#070b14',
                        border: isSelected ? '1px solid #6d5dfc' : '1px solid #1c2639',
                        cursor: 'pointer',
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className={ep.method === 'POST' ? 'post-badge' : 'get-badge'}>{ep.method}</span>
                        <span style={{ color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: 600 }}>{ep.path}</span>
                      </div>
                      <span style={{ color: '#64738c', fontSize: '11px' }}>&gt;</span>
                    </button>
                  );
                })}
              </div>

              {/* Group 2: REWARDS */}
              <div className="space-y-2 pt-2 border-t border-[#1c2940]/40">
                <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#64738c' }}>
                  REWARDS
                </div>
                {[
                  { method: 'GET', path: '/v1/rewards/{verificationId}', desc: 'Query partner voucher status' },
                  { method: 'POST', path: '/v1/rewards/{verificationId}/redeem', desc: 'Execute instant settlement' },
                ].map((ep) => {
                  const epKey = `${ep.method} ${ep.path}`;
                  const isSelected = selectedEndpoint === epKey;
                  return (
                    <button
                      key={epKey}
                      type="button"
                      onClick={() => setSelectedEndpoint(epKey)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isSelected ? '#171332' : '#070b14',
                        border: isSelected ? '1px solid #6d5dfc' : '1px solid #1c2639',
                        cursor: 'pointer',
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className={ep.method === 'POST' ? 'post-badge' : 'get-badge'}>{ep.method}</span>
                        <span style={{ color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: 600 }}>{ep.path}</span>
                      </div>
                      <span style={{ color: '#64738c', fontSize: '11px' }}>&gt;</span>
                    </button>
                  );
                })}
              </div>

              {/* Group 3: COHORTS */}
              <div className="space-y-2 pt-2 border-t border-[#1c2940]/40">
                <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#64738c' }}>
                  COHORTS
                </div>
                {[
                  { method: 'GET', path: '/v1/cohorts', desc: 'List active sponsored cohorts' },
                  { method: 'GET', path: '/v1/cohorts/{cohortId}', desc: 'Get cohort criteria schema' },
                ].map((ep) => {
                  const epKey = `${ep.method} ${ep.path}`;
                  const isSelected = selectedEndpoint === epKey;
                  return (
                    <button
                      key={epKey}
                      type="button"
                      onClick={() => setSelectedEndpoint(epKey)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isSelected ? '#171332' : '#070b14',
                        border: isSelected ? '1px solid #6d5dfc' : '1px solid #1c2639',
                        cursor: 'pointer',
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="get-badge">{ep.method}</span>
                        <span style={{ color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: 600 }}>{ep.path}</span>
                      </div>
                      <span style={{ color: '#64738c', fontSize: '11px' }}>&gt;</span>
                    </button>
                  );
                })}
              </div>

              {/* Deprecation Warning Demonstration */}
              <div className="p-3 bg-[#171332] border border-[#ef5350]/40 rounded-lg font-mono text-xs space-y-1">
                <div style={{ color: '#ef5350', fontWeight: 700 }}>[DEPRECATED]</div>
                <div style={{ color: '#f4f6fb', fontWeight: 600 }}>reward.trigger()</div>
                <div style={{ color: '#8fa0bb' }}>
                  Use: <code style={{ color: '#00d89a' }}>milestones.verify()</code>
                </div>
                <div style={{ color: '#64738c', fontSize: '10px', marginTop: '4px' }}>
                  Deprecated since v1.3 · Removal planned for v2.0
                </div>
              </div>
            </div>

            {/* Endpoint Documentation Detail */}
            <div className="sdk-card space-y-4">
              <div className="flex items-center gap-2">
                <span className={selectedEndpoint.split(' ')[0] === 'POST' ? 'post-badge' : 'get-badge'}>
                  {selectedEndpoint.split(' ')[0]}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f4f6fb', fontFamily: 'monospace' }}>
                  {selectedEndpoint.split(' ')[1]}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#8fa0bb' }}>
                Verify a user milestone and authorize eligible sponsor reward in sub-250ms.
              </div>

              {/* cURL Example with syntax highlighting */}
              <div className="space-y-1.5 font-mono text-xs">
                <div style={{ color: '#7e8ba6', fontWeight: 700 }}>CURL REQUEST</div>
                <div
                  style={{
                    background: '#070b14',
                    border: '1px solid #1c2639',
                    padding: '12px',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    lineHeight: 1.5,
                  }}
                >
                  {`curl -X POST https://sandbox.api.buildbank.dev/v1/milestones/verify \\
  -H "Authorization: Bearer \$BUILDBANK_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: reader:user_48291:chapter_14" \\
  -d '{
    "cohortId": "reader-14-day",
    "milestone": "chapter_14_complete",
    "user": {
      "externalId": "user_48291"
    },
    "proof": {
      "streakDays": 14,
      "completionPercent": 100,
      "scorePercent": 98
    }
  }'`
                    .split('\n')
                    .map((line, idx) => (
                      <div key={idx}>
                        {tokenizeLine(line).map((tok, tIdx) => (
                          <span key={tIdx} className={tok.className}>
                            {tok.text}
                          </span>
                        ))}
                      </div>
                    ))}
                </div>
              </div>

              {/* Schema Table */}
              <div className="border-t border-[#26334b] pt-3 space-y-2">
                <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6' }}>
                  REQUEST BODY SCHEMA
                </span>
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#26334b] text-[#64738c]">
                      <th className="pb-1">FIELD</th>
                      <th className="pb-1">TYPE</th>
                      <th className="pb-1">REQUIRED</th>
                      <th className="pb-1">DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2639]">
                    <tr>
                      <td className="py-1 text-[#89ddff]">cohortId</td>
                      <td className="py-1 text-[#ffcb6b]">string</td>
                      <td className="py-1 text-[#00d89a]">yes</td>
                      <td className="py-1 text-[#8fa0bb]">Sponsor cohort</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-[#89ddff]">milestone</td>
                      <td className="py-1 text-[#ffcb6b]">string</td>
                      <td className="py-1 text-[#00d89a]">yes</td>
                      <td className="py-1 text-[#8fa0bb]">Completed action</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-[#89ddff]">user.externalId</td>
                      <td className="py-1 text-[#ffcb6b]">string</td>
                      <td className="py-1 text-[#00d89a]">yes</td>
                      <td className="py-1 text-[#8fa0bb]">Platform user ID</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-[#89ddff]">proof.streakDays</td>
                      <td className="py-1 text-[#f78c6c]">integer</td>
                      <td className="py-1 text-[#00d89a]">yes</td>
                      <td className="py-1 text-[#8fa0bb]">Verified streak</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-[#89ddff]">proof.completion</td>
                      <td className="py-1 text-[#f78c6c]">integer</td>
                      <td className="py-1 text-[#00d89a]">yes</td>
                      <td className="py-1 text-[#8fa0bb]">Completion %</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-[#89ddff]">proof.scorePercent</td>
                      <td className="py-1 text-[#f78c6c]">integer</td>
                      <td className="py-1 text-[#7e8ba6]">no</td>
                      <td className="py-1 text-[#8fa0bb]">Optional score</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Error Responses Table */}
              <div className="border-t border-[#26334b] pt-3 space-y-2">
                <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6' }}>
                  ERROR RESPONSES
                </span>
                <div className="space-y-1.5 font-mono text-xs">
                  {[
                    { code: '400', name: 'invalid_request', desc: 'Required milestone fields are missing.' },
                    { code: '401', name: 'invalid_credentials', desc: 'API credential is invalid or expired.' },
                    { code: '409', name: 'duplicate_event', desc: 'Event already verified for this idempotency key.' },
                    { code: '422', name: 'verification_failed', desc: 'Submitted proof does not satisfy cohort criteria.' },
                    { code: '429', name: 'rate_limited', desc: 'Request exceeded configured API rate limit.' },
                    { code: '500', name: 'settlement_unavailable', desc: 'Verification succeeded but settlement is unavailable.' },
                  ].map((err) => (
                    <div key={err.code} className="flex items-start gap-2 py-1 border-b border-[#1c2639]/40">
                      <span style={{ color: '#ef5350', fontWeight: 700 }}>{err.code}</span>
                      <span style={{ color: '#f4f6fb', fontWeight: 600 }}>{err.name}</span>
                      <span style={{ color: '#8fa0bb' }}>{err.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. TAB CONTENT: WEBHOOKS ── */}
      {activeSubnav === 'webhooks' && (
        <div className="space-y-6">
          <div className="sdk-card space-y-4">
            <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
              WEBHOOK INTEGRATION
            </div>
            <p style={{ fontSize: '14px', color: '#8fa0bb' }}>
              BuildBank dispatches signed webhooks to notify your application when milestone verification or settlement changes state.
            </p>

            <div className="space-y-3 max-w-xl">
              <div>
                <label style={{ fontSize: '11px', fontFamily: 'monospace', color: '#7e8ba6' }} className="block mb-1">
                  Webhook Endpoint URL
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="config-input"
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'monospace', color: '#7e8ba6' }} className="block mb-2">
                  Subscribed Event Types
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#f4f6fb]">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="checkbox" defaultChecked className="accent-[#6d5dfc]" />
                    <span>milestone.verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="checkbox" defaultChecked className="accent-[#6d5dfc]" />
                    <span>reward.authorized</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="checkbox" defaultChecked className="accent-[#6d5dfc]" />
                    <span>settlement.completed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="checkbox" className="accent-[#6d5dfc]" />
                    <span>settlement.failed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input type="checkbox" className="accent-[#6d5dfc]" />
                    <span>verification.rejected</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64738c' }}>
                  Signing: <strong style={{ color: '#00d89a' }}>HMAC-SHA256</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setWebhookSent(true);
                    setTimeout(() => setWebhookSent(false), 2000);
                  }}
                  style={{
                    height: '36px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    background: '#6d5dfc',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                  className="hover:bg-[#7b6cff]"
                >
                  {webhookSent ? 'Webhook Dispatched!' : 'Send Test Webhook'}
                </button>
              </div>
            </div>

            {/* Delivery Policy Card */}
            <div className="border-t border-[#26334b] pt-4 space-y-3">
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6' }}>
                DELIVERY POLICY
              </span>
              <div className="p-3 bg-[#070b14] border border-[#1c2639] rounded font-mono text-xs space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[#cbd5e1]">
                  <div>
                    <span style={{ color: '#64738c' }}>Attempt 1:</span> immediate
                  </div>
                  <div>
                    <span style={{ color: '#64738c' }}>Attempt 2:</span> +30s
                  </div>
                  <div>
                    <span style={{ color: '#64738c' }}>Attempt 3:</span> +5m
                  </div>
                  <div>
                    <span style={{ color: '#64738c' }}>Attempt 4:</span> +30m
                  </div>
                </div>
                <div style={{ color: '#00d89a', fontSize: '11px' }}>
                  ✓ Successful 2xx response marks delivery complete.
                </div>
                <div style={{ color: '#8fa0bb', fontSize: '11px' }}>
                  Non-2xx response: event remains retryable until delivery window expires. Events are never silently discarded.
                </div>
              </div>
            </div>

            {/* Example Dispatched Payload */}
            <div className="border-t border-[#26334b] pt-4 space-y-2">
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#7e8ba6' }}>
                EXAMPLE PAYLOAD (DISPATCHED ON SETTLEMENT)
              </span>
              <pre
                style={{
                  background: '#070b14',
                  padding: '12px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#00d89a',
                }}
              >
                {JSON.stringify(
                  {
                    event: 'settlement.completed',
                    id: 'evt_01J8A49D7E8B1C2D3',
                    verificationId: 'ver_01J8A49D7E8B1C2D3',
                    rewardCode: 'SPONSOR-READER-500',
                    timestamp: '2026-09-12T08:42:11Z',
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. TAB CONTENT: SECURITY ── */}
      {activeSubnav === 'security' && (
        <div className="space-y-6">
          <div className="sdk-card space-y-4">
            <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6', letterSpacing: '0.08em' }}>
              AUTHENTICATION & REPLAY PROTECTION
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#070b14] border border-[#1c2639] rounded-lg space-y-2 text-xs">
                <span style={{ color: '#6d5dfc', fontWeight: 700, fontFamily: 'monospace' }}>SERVER-SIDE REQUESTS</span>
                <p style={{ color: '#8fa0bb', lineHeight: 1.5 }}>
                  Use secret API keys only from trusted server environments. Never expose secret keys in client-side bundles or repository code.
                </p>
              </div>

              <div className="p-4 bg-[#070b14] border border-[#1c2639] rounded-lg space-y-2 text-xs">
                <span style={{ color: '#00d89a', fontWeight: 700, fontFamily: 'monospace' }}>PUBLISHABLE CLIENT KEY</span>
                <p style={{ color: '#8fa0bb', lineHeight: 1.5 }}>
                  Client-side key used only for SDK initialization and non-sensitive configuration rendering. Cannot authorize payouts directly.
                </p>
              </div>

              <div className="p-4 bg-[#070b14] border border-[#1c2639] rounded-lg space-y-2 text-xs">
                <span style={{ color: '#a69cff', fontWeight: 700, fontFamily: 'monospace' }}>REQUEST SIGNING</span>
                <p style={{ color: '#8fa0bb', lineHeight: 1.5 }}>
                  All inbound webhook payloads include a <code style={{ color: '#ffffff' }}>BuildBank-Signature</code> header generated via HMAC-SHA256 with timestamp verification.
                </p>
              </div>

              <div className="p-4 bg-[#070b14] border border-[#1c2639] rounded-lg space-y-2 text-xs">
                <span style={{ color: '#f4f6fb', fontWeight: 700, fontFamily: 'monospace' }}>REPLAY PROTECTION</span>
                <p style={{ color: '#8fa0bb', lineHeight: 1.5 }}>
                  Timestamp + idempotency key prevent repeated settlement attempts. Duplicate payloads return cached verification results.
                </p>
              </div>
            </div>

            {/* Keys Box */}
            <div className="border-t border-[#26334b] pt-4 space-y-3">
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#7e8ba6' }}>
                API KEYS ({environment.toUpperCase()})
              </span>

              <div className="space-y-2 font-mono text-xs max-w-lg">
                <div>
                  <span style={{ color: '#64738c' }}>Publishable key</span>
                  <div className="p-2.5 bg-[#070b14] border border-[#1c2639] rounded text-[#cbd5e1] mt-1 flex items-center justify-between">
                    <span>pk_{environment}_98f2a1b4c7d9e3f1••••••••</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`pk_${environment}_98f2a1b4c7d9e3f1a0b5c6d7`);
                        setCopiedPubKey(true);
                        setTimeout(() => setCopiedPubKey(false), 1200);
                      }}
                      className="text-[#7e8ba6] hover:text-white"
                      title="Copy publishable key"
                    >
                      {copiedPubKey ? <Check className="w-3 h-3 text-[#00d89a]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ color: '#64738c' }}>Secret key</span>
                  <div className="p-2.5 bg-[#070b14] border border-[#1c2639] rounded text-[#cbd5e1] mt-1 flex items-center justify-between">
                    <span>sk_{environment}_42e9a8f7c1b3d5e2••••••••</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`sk_${environment}_42e9a8f7c1b3d5e2f6a8c0d1`);
                        setCopiedSecretKey(true);
                        setTimeout(() => setCopiedSecretKey(false), 1200);
                      }}
                      className="text-[#7e8ba6] hover:text-white"
                      title="Copy secret key"
                    >
                      {copiedSecretKey ? <Check className="w-3 h-3 text-[#00d89a]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setKeyRotated(true);
                      setTimeout(() => setKeyRotated(false), 2000);
                    }}
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      background: '#171332',
                      border: '1px solid #5046a8',
                      color: '#a69cff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    className="hover:bg-[#201b44] flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{keyRotated ? 'Key Rotated Successfully!' : 'Rotate Secret Key'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
