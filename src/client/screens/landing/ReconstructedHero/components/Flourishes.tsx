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
        zIndex: 50,
      }}
      aria-hidden="true"
    >
      {/* Star doodle 1: Upper left */}
      <div
        style={{
          position: 'absolute',
          top: 68,
          left: 310,
          opacity: 0.85,
        }}
      >
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={12}
          height={12}
        />
      </div>

      {/* Star doodle 2: Upper right */}
      <div
        style={{
          position: 'absolute',
          top: 78,
          right: 298,
          opacity: 0.85,
        }}
      >
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={11}
          height={11}
        />
      </div>

      {/* Star doodle 3: Mid lower left */}
      <div
        style={{
          position: 'absolute',
          bottom: 130,
          left: 288,
          opacity: 0.75,
        }}
      >
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={9}
          height={9}
        />
      </div>

      {/* Star doodle 4: Mid lower right */}
      <div
        style={{
          position: 'absolute',
          bottom: 110,
          right: 290,
          opacity: 0.75,
        }}
      >
        <Image
          src="/images/hero-collage/star-doodle.svg"
          alt=""
          width={10}
          height={10}
        />
      </div>
    </div>
  );
}
