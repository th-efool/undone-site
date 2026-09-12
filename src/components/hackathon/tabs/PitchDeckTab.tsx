'use client';

import React from 'react';
import { Users, TrendingUp, Layers, Check } from 'lucide-react';

export function PitchDeckTab() {
  const chokePoints = [
    {
      num: '01',
      title: 'User Joins',
      desc: 'Starts learning with peak motivation and momentum.',
    },
    {
      num: '02',
      title: 'Deep Work',
      desc: 'Maintains streaks, completes modules, solves quests.',
    },
    {
      num: '03',
      title: 'Paywall Wall',
      desc: 'Hit with aggressive subscription barrier; motivation dies.',
    },
    {
      num: '04',
      title: 'Ad Spam',
      desc: 'Or bombarded with irrelevant banner ads that destroy UX.',
    },
    {
      num: '05',
      title: 'Loss for All',
      desc: 'Platform monetizes poorly, brand is ignored, user leaves.',
    },
  ];

  return (
    <div className="space-y-0">
      {/* ── PROBLEM SECTION ── */}
      <section className="problem-section">
        {/* Two-Column Intro */}
        <div className="problem-intro">
          {/* Left Column: Heading + Description */}
          <div>
            <div className="problem-label">
              01 // THE PROBLEM
            </div>

            <h2 className="problem-title">
              Platforms Can't Monetize,<br />Brands Waste Ad Dollars.
            </h2>

            <p className="problem-description">
              Digital learning platforms produce immense engagement and motivation, but paywalls destroy completion rates and banner ads ruin user experience.
              Meanwhile, consumer brands bleed budget on generic ads that users actively ignore.
            </p>
          </div>

          {/* Right Column: Value Drain Callout */}
          <aside aria-label="The Value Drain" className="value-drain">
            <div className="value-drain-label">
              THE VALUE DRAIN
            </div>
            <p>
              Users invest real hours and intellectual effort, but that proof-of-work rarely converts into sustainable platform revenue or direct sponsor customer acquisition.
            </p>
          </aside>
        </div>

        {/* Choke Point Heading */}
        <div className="choke-point-heading">
          THE BROKEN JOURNEY: 5 CHOKE POINTS
        </div>

        {/* 5 Choke Point Cards Grid */}
        <div className="choke-point-grid">
          {chokePoints.map((cp) => (
            <div key={cp.num} className="choke-point-card">
              <span className="choke-point-number">{cp.num}</span>
              <h3 className="choke-point-title">{cp.title}</h3>
              <p className="choke-point-description">{cp.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SOLUTION SECTION ── */}
      <section className="solution-section">
        {/* Solution Section Header: Symmetric Two-Column */}
        <div className="solution-section-header">
          {/* Left Column: Heading + Description */}
          <div>
            <div className="solution-label">
              02 // THE SOLUTION
            </div>

            <h2 className="solution-title">
              The Embedded Financial Rewards Engine
            </h2>

            <p className="solution-description">
              Convert verified user effort into real economic incentives. Brands sponsor learning cohorts (e.g. AWS sponsors cloud tracks, Amazon sponsors reading habits). When users achieve milestones, BuildBank verifies proof-of-work in under 250ms and unlocks partner capital on the spot.
            </p>
          </div>

          {/* Right Column: Flywheel Callout */}
          <aside aria-label="Flywheel Callout" className="flywheel-callout">
            <div className="flywheel-callout-label">
              WIN-WIN-WIN FLYWHEEL
            </div>
            <p>
              Users earn tangible savings. Brands acquire high-intent, qualified customers. Platforms monetize native engagement without user-facing paywalls.
            </p>
          </aside>
        </div>

        {/* Three Solution Cards */}
        <div className="solution-benefits">
          {/* For Users */}
          <div className="solution-card user-card">
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="card-icon"
            >
              <Users className="w-4 h-4" />
            </div>

            <h3 className="solution-card-title">For Users</h3>
            <div className="solution-card-subtitle">Real Economic Benefits</div>

            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Instant partner discounts (₹500+ credits)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Zero off-platform redirect drop-off</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Financial motivation to complete hard skills</span>
              </li>
            </ul>
          </div>

          {/* For Brand Partners */}
          <div className="solution-card brand-card">
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="card-icon"
            >
              <TrendingUp className="w-4 h-4" />
            </div>

            <h3 className="solution-card-title">For Brand Partners</h3>
            <div className="solution-card-subtitle">High-Intent Acquisition</div>

            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Acquire verified users on proven interest</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Pay only upon verified milestone completion</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Measurable, anti-fraud campaign telemetry</span>
              </li>
            </ul>
          </div>

          {/* For Platforms */}
          <div className="solution-card platform-card">
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="card-icon"
            >
              <Layers className="w-4 h-4" />
            </div>

            <h3 className="solution-card-title">For Platforms</h3>
            <div className="solution-card-subtitle">Frictionless Monetization</div>

            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Higher retention without paywall churn</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>Simple 3-line React SDK drop-in</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="benefit-check" />
                <span>New revenue stream from brand sponsor pool</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Long-Term Vision Banner */}
        <div className="vision-banner">
          <div className="vision-label">
            THE LONG-TERM VISION
          </div>
          <p className="vision-text">
            Transforming everyday verified human effort into instant financial value, embedded directly inside every learning application.
          </p>
        </div>
      </section>
    </div>
  );
}
