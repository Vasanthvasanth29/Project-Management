import React, { useId } from 'react';

interface IterationCycleIconProps {
  /** Accessible name — only needed when no visible text label exists. */
  title?: string;
  className?: string;
}

/**
 * FlowExec iteration / work-item marker: a segmented cycle (three rounded arc
 * segments of one ring) with a directional arrowhead closing the gap — the
 * visual of work moving around an iteration loop rather than a document,
 * clipboard or sparkle.
 *
 * Single shared implementation used by WorkItemIcon so every issue/task list
 * row (Iterations, Iteration Board, search, work queue) shows the same glyph.
 * The SVG is size-agnostic (callers pass w-/h- classes like any lucide icon),
 * stays sharp from 14px up and keeps the existing row tile sizing untouched.
 * Decorative by default (aria-hidden); pass `title` to expose it as an image.
 */
export const IterationCycleIcon: React.FC<IterationCycleIconProps> = ({ title, className = '' }) => {
  const gradientId = `ici-${useId().replace(/:/g, '')}`;

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
        <linearGradient
          id={gradientId}
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#115E59" />
          <stop offset="0.55" stopColor="#0F766E" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Three rounded arc segments of the iteration ring (clockwise) */}
      <g
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M14.87 4.11A8.4 8.4 0 0 1 19.61 15.55" />
        <path d="M17.4 18.43A8.4 8.4 0 0 1 5.12 16.82" />
        <path d="M3.73 13.46A8.4 8.4 0 0 1 11.27 3.63" />
      </g>

      {/* Directional arrowhead — work advancing into the next cycle */}
      <path d="M11.4 5.12L14.56 3.34L11.14 2.14Z" fill={`url(#${gradientId})`} />
    </svg>
  );
};
