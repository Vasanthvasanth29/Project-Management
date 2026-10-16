import React from 'react';

const GRID = '#e8eaed';
const AXIS = '#c9cdd3';
const BLUE = '#2563eb';
const TEAL = '#0d9488';
const GREY = '#9ca3af';
const GREEN = '#16a34a';
const ORANGE = '#f59e0b';

const frame = (children: React.ReactNode) => (
  <svg
    viewBox="0 0 160 88"
    className="w-full h-full"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <rect x="0" y="0" width="160" height="88" fill="#fbfcfd" />
    {children}
  </svg>
);

const Axes = () => (
  <>
    <line x1="16" y1="10" x2="16" y2="72" stroke={AXIS} strokeWidth="1" />
    <line x1="16" y1="72" x2="150" y2="72" stroke={AXIS} strokeWidth="1" />
    <line x1="16" y1="56" x2="150" y2="56" stroke={GRID} strokeWidth="1" />
    <line x1="16" y1="40" x2="150" y2="40" stroke={GRID} strokeWidth="1" />
    <line x1="16" y1="24" x2="150" y2="24" stroke={GRID} strokeWidth="1" />
  </>
);

export const BurndownPreview: React.FC = () =>
  frame(
    <>
      <Axes />
      <line x1="16" y1="18" x2="150" y2="72" stroke={GREY} strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline
        points="16,18 38,20 60,32 82,34 104,50 126,54 150,66"
        fill="none"
        stroke={BLUE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="32" r="2.2" fill={BLUE} />
      <circle cx="104" cy="50" r="2.2" fill={BLUE} />
      <circle cx="150" cy="66" r="2.2" fill={BLUE} />
      <rect x="108" y="12" width="14" height="3" rx="1.5" fill={BLUE} />
      <rect x="126" y="12" width="14" height="3" rx="1.5" fill={GREY} />
    </>
  );

export const BurnupPreview: React.FC = () =>
  frame(
    <>
      <Axes />
      <line x1="16" y1="26" x2="104" y2="26" stroke={GREY} strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="104" y1="26" x2="150" y2="18" stroke={GREY} strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline
        points="16,68 38,64 60,54 82,46 104,36 126,30 150,24"
        fill="none"
        stroke={TEAL}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="82" cy="46" r="2.2" fill={TEAL} />
      <circle cx="150" cy="24" r="2.2" fill={TEAL} />
      <rect x="112" y="10" width="12" height="3" rx="1.5" fill={TEAL} />
      <rect x="128" y="10" width="16" height="3" rx="1.5" fill={GREY} />
    </>
  );

export const SprintReportPreview: React.FC = () =>
  frame(
    <>
      <rect x="14" y="10" width="52" height="6" rx="2" fill="#d7dbe0" />
      <rect x="120" y="9" width="26" height="8" rx="4" fill="#dcfce7" />
      <rect x="14" y="24" width="132" height="7" rx="3.5" fill="#eef1f4" />
      <rect x="14" y="24" width="77" height="7" rx="3.5" fill={BLUE} />
      {[
        { y: 38, w: 64, chip: GREEN },
        { y: 49, w: 86, chip: GREEN },
        { y: 60, w: 52, chip: ORANGE },
        { y: 71, w: 74, chip: GREY },
      ].map((r) => (
        <g key={r.y}>
          <circle cx="20" cy={r.y + 3} r="3" fill={r.chip} />
          <rect x="28" y={r.y} width={r.w} height="3" rx="1.5" fill="#c9cdd3" />
          <rect x="28" y={r.y + 5} width={Math.max(24, r.w - 30)} height="3" rx="1.5" fill="#e2e5e9" />
          <rect x="126" y={r.y + 1} width="20" height="5" rx="2.5" fill="#eef1f4" />
        </g>
      ))}
    </>
  );

export const VelocityPreview: React.FC = () =>
  frame(
    <>
      <line x1="16" y1="72" x2="150" y2="72" stroke={AXIS} strokeWidth="1" />
      <line x1="16" y1="52" x2="150" y2="52" stroke={GRID} strokeWidth="1" />
      <line x1="16" y1="32" x2="150" y2="32" stroke={GRID} strokeWidth="1" />
      <rect x="26" y="40" width="18" height="32" rx="2" fill={BLUE} opacity="0.85" />
      <rect x="54" y="28" width="18" height="44" rx="2" fill={BLUE} opacity="0.85" />
      <rect x="82" y="46" width="18" height="26" rx="2" fill={BLUE} opacity="0.85" />
      <rect x="110" y="22" width="18" height="50" rx="2" fill={TEAL} />
      <line x1="20" y1="36" x2="146" y2="36" stroke={GREY} strokeWidth="1.5" strokeDasharray="4 3" />
    </>
  );

export const CfdPreview: React.FC = () =>
  frame(
    <>
      <Axes />
      <polygon points="16,72 150,72 150,58 16,64" fill={GREY} opacity="0.55" />
      <polygon points="16,64 150,58 150,44 16,50" fill={BLUE} opacity="0.65" />
      <polygon points="16,50 150,44 150,30 16,38" fill={TEAL} opacity="0.7" />
      <polygon points="16,38 150,30 150,16 16,24" fill={GREEN} opacity="0.7" />
      <line x1="16" y1="64" x2="150" y2="58" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
      <line x1="16" y1="50" x2="150" y2="44" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
      <line x1="16" y1="38" x2="150" y2="30" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
    </>
  );

export const VersionPreview: React.FC = () =>
  frame(
    <>
      <line x1="16" y1="46" x2="150" y2="46" stroke={AXIS} strokeWidth="1.5" />
      <polyline
        points="16,64 44,58 72,52 100,44 128,36 150,30"
        fill="none"
        stroke={BLUE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="58" r="3" fill="#ffffff" stroke={BLUE} strokeWidth="2" />
      <circle cx="100" cy="44" r="3" fill="#ffffff" stroke={BLUE} strokeWidth="2" />
      <line x1="128" y1="16" x2="128" y2="72" stroke={ORANGE} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M124 12 L132 12 L128 19 Z" fill={ORANGE} />
      <rect x="24" y="72" width="26" height="5" rx="2.5" fill="#eef1f4" />
      <rect x="86" y="72" width="26" height="5" rx="2.5" fill="#eef1f4" />
      <circle cx="150" cy="30" r="2.5" fill={BLUE} />
    </>
  );
