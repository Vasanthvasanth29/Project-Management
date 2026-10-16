import React from 'react';
import { ClipboardList } from 'lucide-react';
import { IterationCycleIcon } from './IterationCycleIcon';
import { StoryIcon } from './StoryIcon';
import { BugIssueIcon } from './BugIssueIcon';

interface WorkItemIconProps {
  /** Work-item type shown as the hover tooltip (e.g. STORY, BUG, TASK). */
  typeLabel?: string;
  className?: string;
}

/**
 * FlowExec work-item marker for issue/task list rows — rendered right after
 * the row checkbox in the Iterations/Iteration Board and backlog lists.
 *
 * A 28x28 rounded container whose tint matches the work-item type:
 * STORY rows show the StoryIcon (folded story page + four-point mint sparkle
 * on a vibrant emerald gradient) on the soft teal/mint tile (#CCFBF1), TASK
 * rows keep the IterationCycleIcon (segmented cycle with a
 * directional arrowhead — work moving through an iteration) on the same teal
 * tile, BUG/BUG_FIX rows show the shared BugIssueIcon on
 * the very light red/pink tile (#FEE2E2), and every other type keeps the
 * brand teal ClipboardList glyph (#0D9488) on the teal tile. The symmetric
 * -my-1.5 keeps the taller container from increasing the row height, so row
 * padding, spacing and alignment of the key/title columns stay untouched.
 */
export const WorkItemIcon: React.FC<WorkItemIconProps> = ({ typeLabel, className = '' }) => {
  const normalized = String(typeLabel ?? '').toUpperCase();
  const isStory = normalized === 'STORY';
  const isTask = normalized === 'TASK';
  const isBug = normalized === 'BUG' || normalized === 'BUG_FIX';

  return (
    <span
      title={typeLabel}
      className={`inline-flex flex-shrink-0 items-center justify-center w-7 h-7 rounded-md ${
        isBug ? 'bg-[#FEE2E2]' : 'bg-[#CCFBF1]'
      } -my-1.5 ${className}`}
    >
      {isStory ? (
        <StoryIcon className="w-[18px] h-[18px]" />
      ) : isTask ? (
        <IterationCycleIcon className="w-[18px] h-[18px]" />
      ) : isBug ? (
        <BugIssueIcon className="w-[18px] h-[18px]" />
      ) : (
        <ClipboardList className="w-[18px] h-[18px] text-[#0D9488]" strokeWidth={2} />
      )}
    </span>
  );
};
