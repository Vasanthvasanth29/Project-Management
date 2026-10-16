import React from 'react';
import { Sparkles } from 'lucide-react';

interface ProjectInsightProps {
  insight: string;
}

export const ProjectInsight: React.FC<ProjectInsightProps> = ({ insight }) => {
  return (
    <div className="card p-6" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #f8fafc 50%, #eff6ff 100%)' }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#ccfbf1] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-[#0d9488]" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-[#1a1d23] mb-1.5 font-display">Project Insight Summary</h3>
          <p className="text-[11px] text-[#4b5563] leading-relaxed">{insight}</p>
          <p className="text-[9px] text-[#9ca3af] mt-2 italic">
            This summary is auto-generated from current project metrics and should be used as guidance, not as a definitive assessment.
          </p>
        </div>
      </div>
    </div>
  );
};
