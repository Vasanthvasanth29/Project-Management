import React, { useId } from 'react';

interface StoryTaskIconProps {
  /** Accessible name — only needed when no visible text label exists. */
  title?: string;
  className?: string;
}

/**
 * Approved FlowExec Story/Task icon: a centered four-point sparkle/diamond
 * with slightly rounded organic tips, two accent rays and two accent dots.
 * Color treatment (shape/geometry unchanged): a rich, saturated deep-teal
 * -> emerald fill (#115E59 -> #0F766E -> #059669) with a subtle fading
 * cyan edge highlight (#67E8F9 -> #22D3EE -> transparent) along the
 * top-right edges for premium depth. No text, no document/page shape,
 * no Jira-style symbol, never neon.
 *
 * Single shared implementation used by TaskTypeBadge, CreateWorkItemModal
 * and WorkItemIcon so Story/Task render identically everywhere. The SVG is
 * size-agnostic (callers pass w-/h- classes like any lucide icon) and stays
 * sharp from 14px up. Decorative by default (aria-hidden) because every
 * call site pairs it with the issue-type text or a title tooltip; pass
 * `title` to expose it as an image with an accessible name instead.
 */
export const StoryTaskIcon: React.FC<StoryTaskIconProps> = ({ title, className = '' }) => {
  const gradientId = `sti-${useId().replace(/:/g, '')}`;
  const edgeId = `${gradientId}-e`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="3.5" y1="3.5" x2="20.5" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#115E59" />
          <stop offset="0.5" stopColor="#0F766E" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id={edgeId} x1="20.5" y1="3.5" x2="9" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#67E8F9" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#22D3EE" stopOpacity="0.45" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Accent rays */}
      <path
        d="M18.3 6.5 19.7 5.1"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M5.7 17.5 4.3 18.9"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Accent dots */}
      <circle cx="5.3" cy="5.7" r="1" fill="#0F766E" opacity="0.6" />
      <circle cx="18.7" cy="18.3" r="1" fill="#06B6D4" opacity="0.65" />

      {/* Main four-point sparkle/diamond with soft organic tips */}
      <path
        d="M12 3.2C12.9 7 17 11.1 20.8 12C17 12.9 12.9 17 12 20.8C11.1 17 7 12.9 3.2 12C7 11.1 11.1 7 12 3.2Z"
        fill={`url(#${gradientId})`}
      />
      {/* Subtle cyan edge highlight on the top-right edges (same path) */}
      <path
        d="M12 3.2C12.9 7 17 11.1 20.8 12C17 12.9 12.9 17 12 20.8C11.1 17 7 12.9 3.2 12C7 11.1 11.1 7 12 3.2Z"
        fill="none"
        stroke={`url(#${edgeId})`}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
};
