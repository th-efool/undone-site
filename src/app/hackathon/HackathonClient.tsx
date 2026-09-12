'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Coins, Copy, Check, CheckCircle2, ArrowLeft } from 'lucide-react';
import './hackathon.css';
import { TabsNav, TabType } from '@/src/components/hackathon/TabsNav';
import { SimulatorTab } from '@/src/components/hackathon/tabs/SimulatorTab';
import { PitchDeckTab } from '@/src/components/hackathon/tabs/PitchDeckTab';
import { SDKTab } from '@/src/components/hackathon/tabs/SDKTab';
import { SubmissionTab } from '@/src/components/hackathon/tabs/SubmissionTab';
import { DEFAULT_SUBMISSION, SubmissionData, SimulationResponse } from '@/src/lib/hackathon/data';

export default function HackathonClient() {
  const [activeTab, setActiveTab] = useState<TabType>('simulator');
  const [selectedAction, setSelectedAction] = useState<string>('reader_cohort');
  const [simStep, setSimStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [submission, setSubmission] = useState<SubmissionData>(DEFAULT_SUBMISSION);
  const [copiedSubmission, setCopiedSubmission] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bb_hackathon_submission');
      if (saved) {
        try {
          setSubmission(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse saved submission', e);
        }
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveSubmission = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bb_hackathon_submission', JSON.stringify(submission));
      showToast('Submission draft saved to local storage.');
    }
  };

  const handleCopyMarkdown = () => {
    const md = `# 🏆 Hackathon Submission: ${submission.projectName}

**Track:** ${submission.track}  
**Tagline:** ${submission.tagline}  
**Live Demo:** ${submission.demoUrl || 'https://sidequesthq.com/hackathon'}  
**GitHub Repository:** ${submission.githubUrl}  
**Pitch Deck Link:** ${submission.pitchDeckUrl || 'Uploaded in portal'}  
**Loom Demo Video:** ${submission.loomVideoUrl || 'Available on request'}  
**Team:** ${submission.teamMembers} (${submission.contactEmail})

---

### 1. ⚠️ The Problem Statement: Financial Incentives Disconnected From User Behavior
${submission.problemSummary}

---

### 2. 💡 The Solution: Embedded Financial Rewards Layer
${submission.solutionSummary}

---

### 3. 🚀 Key Innovations & Tech Stack
${submission.keyInnovations}
- **Frontend & App:** Next.js 16 App Router, React 19, Tailwind CSS, TypeScript
- **Embedded Engine:** BuildBank Rule Evaluator, Sub-250ms Verification Pipeline
- **Partners Simulated:** Amazon Kindle/Audible, AWS/Cloudflare, Zerodha/Groww, Cult.fit
`;
    navigator.clipboard.writeText(md);
    setCopiedSubmission(true);
    showToast('Markdown copied to clipboard!');
    setTimeout(() => setCopiedSubmission(false), 3000);
  };

  const handleTriggerSimulation = async (actionKey?: string) => {
    const targetAction = actionKey || selectedAction;
    setIsLoading(true);
    setSimStep(2);

    try {
      const res = await fetch('/api/hackathon/simulate-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: targetAction,
          platform: 'SideQuestHQ',
          metadata: {
            cohortName: targetAction === 'dev_cohort' ? 'Full-Stack Web Dev' : 'Become a Reader Again',
            milestone: 'Completed Final Milestone',
            scorePercent: 98,
          },
        }),
      });

      if (!res.ok) throw new Error('Simulation failed');

      const data: SimulationResponse = await res.json();
      setSimResult(data);
    } catch (err) {
      console.warn('Using client verification fallback:', err);
      setSimResult({
        success: true,
        status: 'VERIFIED',
        verificationId: `bb_vrf_${Math.random().toString(36).substring(2, 10)}`,
        timestamp: new Date().toISOString(),
        action: {
          type: targetAction,
          evaluatedCriteria: {
            platform: 'SideQuestHQ',
            userActivityVerified: true,
            confidenceScore: 0.994,
            fraudCheckPassed: true,
          },
        },
        reward: {
          id: 'rew_fallback',
          partnerName: targetAction === 'dev_cohort' ? 'AWS & Cloudflare' : 'Amazon Kindle & Audible',
          partnerCategory: targetAction === 'dev_cohort' ? 'Developer Infrastructure' : 'Reading & Audiobooks',
          logo: targetAction === 'dev_cohort' ? '⚡' : '📚',
          rewardHeadline: targetAction === 'dev_cohort' ? '₹1,000 AWS & Cloud Sandbox Credits' : '₹500 OFF Any Kindle Book or Free Audiobook',
          rewardValue: targetAction === 'dev_cohort' ? '₹1,000 Credits' : '₹500 OFF',
          numericValue: targetAction === 'dev_cohort' ? 1000 : 500,
          currency: 'INR',
          code: targetAction === 'dev_cohort' ? 'SPONSOR-CLOUD-1000' : 'SPONSOR-READER-500',
          terms: 'Valid upon verified cohort milestone completion.',
          expiresInMinutes: 60,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          redemptionStatus: 'READY_TO_REDEEM',
        },
        metrics: {
          latencyMs: 195,
          conversionLiftProjected: '+34%',
          redemptionRateEstimated: '92.4%',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeemNow = () => setSimStep(4);
  const handleResetSim = () => {
    setSimStep(1);
    setSimResult(null);
  };

  return (
    <div className="buildbank-root min-h-screen bg-[#05070b] text-[#f5f7fb] font-sans selection:bg-[#303b52]">
      {/* ── Sticky Header (68px, 3 explicit zones) ── */}
      <header className="navbar sticky top-0 z-40">
        <div className="navbar-inner">
          {/* Left: Brand (width: 230px, flex-shrink: 0) */}
          <div className="navbar-brand flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0e1420] border border-[#1c2738] flex items-center justify-center text-[#00d89a] shrink-0">
              <Coins className="w-4 h-4 text-[#00d89a]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[#f5f7fb]">BuildBank</span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#0e1420] text-[#9aa7bb] border border-[#1c2738]">
                MVP
              </span>
            </div>
          </div>

          {/* Center: Navigation (flex: 1, centered, gap: 6px) */}
          <div className="navbar-nav">
            <TabsNav activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          {/* Right: Quiet Utility Actions (width: 230px, flex-shrink: 0, justify-end, gap: 6px) */}
          <div className="navbar-actions">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="utility-action cursor-pointer"
            >
              {copiedSubmission ? <Check className="w-3.5 h-3.5 text-[#00d89a]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSubmission ? 'Copied!' : 'Copy Dossier'}</span>
            </button>
            <Link
              href="/"
              className="utility-action"
            >
              <span>↩ Exit</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0d1424] border border-[#26334b] text-[#f4f6fb] font-mono text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-[#00d89a]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Main Content Container ── */}
      <main className="app-shell py-8 sm:py-10">
        {activeTab === 'simulator' && (
          <SimulatorTab
            selectedAction={selectedAction}
            setSelectedAction={setSelectedAction}
            simStep={simStep}
            setSimStep={setSimStep}
            isLoading={isLoading}
            simResult={simResult}
            handleTriggerSimulation={handleTriggerSimulation}
            handleResetSim={handleResetSim}
            handleRedeemNow={handleRedeemNow}
          />
        )}

        {activeTab === 'deck' && <PitchDeckTab />}

        {activeTab === 'sdk' && <SDKTab />}

        {activeTab === 'submission' && (
          <SubmissionTab
            submission={submission}
            setSubmission={setSubmission}
            handleSaveSubmission={handleSaveSubmission}
            handleCopyMarkdown={handleCopyMarkdown}
            copiedSubmission={copiedSubmission}
          />
        )}
      </main>
    </div>
  );
}
