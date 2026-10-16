import React from 'react';
import type { Task } from '../../types';
import { ClipboardCheck, Lightbulb, TestTube2 } from 'lucide-react';
import { IssueSection } from './IssueSection';

interface AcceptanceCriteriaProps {
  task: Task;
  defaultOpen?: boolean;
}

const renderBody = (text: string) => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  if (lines.length === 1) {
    return <p className="text-xs text-slate-700 leading-relaxed">{lines[0]}</p>;
  }

  return (
    <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
      {lines.map((line, index) => (
        <li key={index} className="flex items-start gap-2">
          <CheckMark />
          <span className="min-w-0">{line.replace(/^[-*•]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  );
};

const CheckMark = () => (
  <span className="mt-0.5 w-3.5 h-3.5 rounded-full bg-[#ccfbf1] border border-[#5eead4] flex items-center justify-center flex-shrink-0">
    <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488]" />
  </span>
);

/**
 * Dedicated "Test Case / Acceptance Criteria" section for Epics
 * (plus Acceptance Criteria / Benefit Hypothesis where applicable).
 * Epics always render the section; every other type renders it only when
 * criteria or a benefit hypothesis is actually documented.
 */
export const AcceptanceCriteria: React.FC<AcceptanceCriteriaProps> = ({ task, defaultOpen = true }) => {
  const isEpic = task.type === 'EPIC';

  const testCase = task.testCase;
  const criteria = task.acceptanceCriteria;
  const hypothesis = task.benefitHypothesis;

  if (!isEpic && !criteria && !hypothesis) return null;

  const blocks: { key: string; title: string; icon: React.ReactNode; body: string | undefined }[] = [];

  if (isEpic) {
    blocks.push({
      key: 'testcase',
      title: 'Test Case / Acceptance Criteria',
      icon: <TestTube2 className="w-3.5 h-3.5 text-[#0f766e]" />,
      body: testCase,
    });
    blocks.push({
      key: 'ac',
      title: 'Acceptance Criteria',
      icon: <ClipboardCheck className="w-3.5 h-3.5 text-[#0f766e]" />,
      body: criteria,
    });
    blocks.push({
      key: 'benefit',
      title: 'Benefit Hypothesis',
      icon: <Lightbulb className="w-3.5 h-3.5 text-[#d97706]" />,
      body: hypothesis,
    });
  } else {
    if (criteria) {
      blocks.push({
        key: 'ac',
        title: 'Acceptance Criteria',
        icon: <ClipboardCheck className="w-3.5 h-3.5 text-[#0f766e]" />,
        body: criteria,
      });
    }
    if (hypothesis) {
      blocks.push({
        key: 'benefit',
        title: 'Benefit Hypothesis',
        icon: <Lightbulb className="w-3.5 h-3.5 text-[#d97706]" />,
        body: hypothesis,
      });
    }
  }

  const hasAnyBody = blocks.some((b) => b.body && b.body.trim());

  return (
    <IssueSection
      title={isEpic ? 'Test Case / Acceptance Criteria' : 'Acceptance Criteria'}
      icon={<ClipboardCheck className="w-3.5 h-3.5 text-[#0d9488]" />}
      defaultOpen={defaultOpen}
      bodyClassName="space-y-4"
    >
      {!hasAnyBody ? (
        <p className="text-xs text-slate-400 py-2">
          No test cases or acceptance criteria documented yet.
        </p>
      ) : (
        blocks.map((block) => (
          <div key={block.key} className="space-y-1.5">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              {block.icon}
              {block.title}
            </h4>
            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e5ea]">
              {block.body ? renderBody(block.body) : <p className="text-xs text-slate-400 italic">Not documented</p>}
            </div>
          </div>
        ))
      )}
    </IssueSection>
  );
};
