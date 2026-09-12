'use client';

import React from 'react';
import { Copy, Check, Save, FileText, CheckCircle2 } from 'lucide-react';
import { SubmissionData } from '@/src/lib/hackathon/data';

interface SubmissionTabProps {
  submission: SubmissionData;
  setSubmission: React.Dispatch<React.SetStateAction<SubmissionData>>;
  handleSaveSubmission: () => void;
  handleCopyMarkdown: () => void;
  copiedSubmission: boolean;
}

export function SubmissionTab({
  submission,
  setSubmission,
  handleSaveSubmission,
  handleCopyMarkdown,
  copiedSubmission,
}: SubmissionTabProps) {
  return (
    <div className="space-y-8">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-800 pb-8">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono font-bold uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              Judging Package & Dossier
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Hackathon Submission Details
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Review and customize your submission parameters. Edits are auto-saved to localStorage and ready to export directly into hackathon portals (Devpost, Devfolio, DoraHacks).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSaveSubmission}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold uppercase transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Local</span>
            </button>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/30 active:scale-98"
            >
              {copiedSubmission ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSubmission ? 'COPIED MD!' : 'COPY MARKDOWN'}</span>
            </button>
          </div>
        </div>

        {/* Input Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          <div className="space-y-2">
            <label htmlFor="projectName" className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Project Title
            </label>
            <input
              id="projectName"
              type="text"
              value={submission.projectName}
              onChange={(e) => setSubmission({ ...submission, projectName: e.target.value })}
              onBlur={handleSaveSubmission}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all font-medium"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="track" className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Hackathon Track
            </label>
            <input
              id="track"
              type="text"
              value={submission.track}
              onChange={(e) => setSubmission({ ...submission, track: e.target.value })}
              onBlur={handleSaveSubmission}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all font-medium"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="tagline" className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Tagline
            </label>
            <input
              id="tagline"
              type="text"
              value={submission.tagline}
              onChange={(e) => setSubmission({ ...submission, tagline: e.target.value })}
              onBlur={handleSaveSubmission}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all font-medium"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="demoUrl" className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Live Demo URL
            </label>
            <input
              id="demoUrl"
              type="text"
              value={submission.demoUrl}
              onChange={(e) => setSubmission({ ...submission, demoUrl: e.target.value })}
              onBlur={handleSaveSubmission}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="githubUrl" className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              GitHub Repository
            </label>
            <input
              id="githubUrl"
              type="text"
              value={submission.githubUrl}
              onChange={(e) => setSubmission({ ...submission, githubUrl: e.target.value })}
              onBlur={handleSaveSubmission}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="problemSummary" className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Problem Summary
            </label>
            <textarea
              id="problemSummary"
              rows={3}
              value={submission.problemSummary}
              onChange={(e) => setSubmission({ ...submission, problemSummary: e.target.value })}
              onBlur={handleSaveSubmission}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all leading-relaxed resize-y"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="solutionSummary" className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Solution Summary
            </label>
            <textarea
              id="solutionSummary"
              rows={3}
              value={submission.solutionSummary}
              onChange={(e) => setSubmission({ ...submission, solutionSummary: e.target.value })}
              onBlur={handleSaveSubmission}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all leading-relaxed resize-y"
            />
          </div>
        </div>

        {/* Export Banner */}
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-mono">
            Formatted with markdown headers, links, and partner specs ready for judging portals.
          </span>
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98"
          >
            {copiedSubmission ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copiedSubmission ? 'Copied Full Markdown' : 'Copy Submission Markdown'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
