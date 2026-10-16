import React, { useId } from 'react';

interface StoryIconProps {
  /** Accessible name — only needed when no visible text label exists. */
  title?: string;
  className?: string;
}

/**
 * FlowExec Story icon: a folded story/page shape with a distinctive
 * four-point sparkle breaking out of its bottom-right corner. Colours follow
 * the FlowExec teal/emerald design system: the page uses a vibrant emerald
 * gradient (#047857 -> #059669 -> #10B981) with a lighter mint fold flap as
 * the only internal detail, and the sparkle uses a bright mint-green
 * gradient (#D1FAE5 -> #6EE7B7 -> #34D399) with a thin white separation edge
 * so it stays high-contrast and crisp against the page on the light mint row
 * tile at 16px/24px. Explicit green fills only — nothing inherits a blue
 * colour. No background tile, glow or shadow — the SVG has a transparent
 * background. No small text lines or extra accents that would blur at
 * compact sizes.
 *
 * Used for STORY work items only (Task/Bug/Epic/Sub-task keep their existing
 * icons). Single shared implementation wired into WorkItemIcon (Iterations /
 * Iteration Board / backlog / issue-search rows), TaskTypeBadge and
 * CreateWorkItemModal so Story renders identically everywhere. Size-agnostic
 * (callers pass w-/h- classes like any lucide icon). Decorative by default
 * (aria-hidden); pass `title` to expose it as an image with an accessible
 * name.
 */
export const StoryIcon: React.FC<StoryIconProps> = ({ title, className = '' }) => {
  const gradientId = `si-${useId().replace(/:/g, '')}`;
  const foldId = `${gradientId}-f`;
  const sparkleId = `${gradientId}-s`;

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
        <linearGradient id={gradientId} x1="5" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#047857" />
          <stop offset="0.55" stopColor="#059669" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id={foldId} x1="13" y1="3" x2="16.2" y2="7.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#34D399" />
        </linearGradient>
        <linearGradient id={sparkleId} x1="13.6" y1="13.6" x2="21.6" y2="21.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D1FAE5" />
          <stop offset="0.5" stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* Folded story page — rounded body with the top-right corner turned down */}
      <path
        d="M13.2 3H6.6A2.6 2.6 0 0 0 4 5.6v12.8A2.6 2.6 0 0 0 6.6 21h7.6a2 2 0 0 0 2-2V7.4L13.2 3Z"
        fill={`url(#${gradientId})`}
      />
      {/* Fold flap (lighter mint-green detail) */}
      <path d="M13.2 3v3.6a1 1 0 0 0 1 1h2L13.2 3Z" fill={`url(#${foldId})`} />

      {/* Four-point mint-green sparkle breaking out of the bottom-right corner */}
      <path
        d="M18 12.8c.35 2.7 2.5 4.85 5.2 5.2-2.7.35-4.85 2.5-5.2 5.2-.35-2.7-2.5-4.85-5.2-5.2 2.7-.35 4.85-2.5 5.2-5.2Z"
        fill={`url(#${sparkleId})`}
        stroke="#FFFFFF"
        strokeOpacity="0.9"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
};
