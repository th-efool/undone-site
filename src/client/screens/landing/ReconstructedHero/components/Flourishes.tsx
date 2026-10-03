'use client';

import React from 'react';
import Image from 'next/image';

export function Flourishes() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 48,
      }}
      aria-hidden="true"
    >
      {/* SVG Arc Linework connecting collage elements matching reference */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        viewBox="0 0 1024 522"
        fill="none"
      >
        {/* Left subtle blue curved arc */}
        <path
          d="M 210 152 C 232 215 208 265 206 320"
          stroke="#1F299D"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Right subtle blue curved arc looping under origami crane */}
        <path
          d="M 768 185 C 742 235 765 285 742 345"
          stroke="#1F299D"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>

      {/* 8-point blue star doodle beside the moon circle */}
      <div
        style={{
          position: 'absolute',
          bottom: 114,
          left: 202,
        }}
      >
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={20}
          height={20}
        />
      </div>
    </div>
  );
}
