import React from 'react';

export default function Logo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Lotus">
      <circle cx="32" cy="32" r="30" fill="#FFF8EC" stroke="#C9A24B" strokeWidth="2.5" />
      <g fill="#E8751A">
        <path d="M32 11c6 7 8 14 0 27-8-13-6-20 0-27z" />
        <path d="M32 41c-9-1-16-7-18-17 9 1 15 6 18 17z" opacity=".85" />
        <path d="M32 41c9-1 16-7 18-17-9 1-15 6-18 17z" opacity=".85" />
        <path d="M32 43c-7 2-14 0-19-6 8-2 15 0 19 6z" opacity=".6" />
        <path d="M32 43c7 2 14 0 19-6-8-2-15 0-19 6z" opacity=".6" />
      </g>
      <path d="M15 48c10 6 24 6 34 0" stroke="#C9A24B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
