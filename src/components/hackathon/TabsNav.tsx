'use client';

import React from 'react';
import { Play, Layers, FileText, Code2 } from 'lucide-react';

export type TabType = 'simulator' | 'deck' | 'sdk' | 'submission';

interface TabsNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export function TabsNav({ activeTab, setActiveTab }: TabsNavProps) {
  const tabs = [
    { id: 'simulator' as TabType, label: 'Live MVP Simulator', icon: Play },
    { id: 'deck' as TabType, label: 'Problem & Solution', icon: Layers },
    { id: 'sdk' as TabType, label: 'Developer SDK', icon: Code2 },
    { id: 'submission' as TabType, label: 'Submission Dossier', icon: FileText },
  ];

  return (
    <nav role="tablist" aria-label="Hackathon Showcase Sections" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
