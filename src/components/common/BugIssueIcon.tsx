import React, { useId } from 'react';

interface BugIssueIconProps {
  /** Accessible name — only needed when no visible text label exists. */
  title?: string;
  className?: string;
}

/**
 * Approved FlowExec Bug issue-type icon: a clean, modern red bug (rounded
 * capsule body, six legs, two antennae) with a white exclamation mark in
 * the center. No text, no page/document shape, deliberately not the
 * Jira bug glyph. Pairs with the very light red/pink rounded-square tile
 * provided by the surrounding surface (WorkItemIcon row tile / badge pill),
 * mirroring how StoryTaskIcon pairs with its teal tile.
 *
 * Single shared implementation used by TaskTypeBadge, CreateWorkItemModal,
 * WorkItemIcon and the member dashboard bug rows so Bug renders identically
 * everywhere. Size-agnostic (callers pass w-/h- classes), sharp from 12px
 * up. Decorative by default (aria-hidden) because call sites pair it with
 * the issue-type text or a title tooltip; pass `title` to expose it as an
 * image with an accessible name instead.
 */
export const BugIssueIcon: React.FC<BugIssueIconProps> = ({ title, className = '' }) => {
  const gradientId = `bii-${useId().replace(/:/g, '')}`;

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
        <linearGradient id={gradientId} x1="6" y1="5" x2="18" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DC2626" />
          <stop offset="1" stopColor="#B91C1C" />
        </linearGradient>
      </defs>

      {/* Antennae + legs (behind the body) */}
      <g stroke={`url(#${gradientId})`} strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M10.3 7.2C9.5 6 8.7 5.3 7.7 4.9" />
        <path d="M13.7 7.2C14.5 6 15.3 5.3 16.3 4.9" />
        <path d="M7.6 10.8 4.5 9.2" />
        <path d="M7.1 13.6 3.9 13.6" />
        <path d="M7.6 16.4 4.5 18" />
        <path d="M16.4 10.8 19.5 9.2" />
        <path d="M16.9 13.6 20.1 13.6" />
        <path d="M16.4 16.4 19.5 18" />
      </g>

      {/* Body */}
      <rect x="7" y="6.9" width="10" height="13.2" rx="5" fill={`url(#${gradientId})`} />

      {/* White exclamation mark */}
      <rect x="11.15" y="9.7" width="1.7" height="4.6" rx="0.85" fill="#FFFFFF" />
      <circle cx="12" cy="16.4" r="1.05" fill="#FFFFFF" />
    </svg>
  );
};
