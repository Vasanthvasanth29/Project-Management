import React from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';

interface RecommendationItem {
  id: string;
  reason: string;
  expectedImpact: string;
  actionLabel: string;
}

interface RecommendationSectionProps {
  recommendations: RecommendationItem[];
  onAction?: (id: string) => void;
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({ recommendations, onAction }) => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <Lightbulb className="w-4 h-4 text-[#f59e0b]" />
          Recommended Actions
        </h2>
        <span className="text-[10px] font-semibold text-[#9ca3af]">{recommendations.length} actions</span>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-8 text-[#9ca3af]">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No recommendations at this time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className="p-4 rounded-xl bg-[#fffbeb] border border-[#fde68a] hover:border-[#fbbf24] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-4 h-4 text-[#d97706]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[#92400e] mb-2 leading-relaxed">
                    <span className="font-bold">Reason:</span> {rec.reason}
                  </p>
                  <p className="text-[10px] text-[#a16207] mb-3">
                    <span className="font-bold">Expected impact:</span> {rec.expectedImpact}
                  </p>
                  <button
                    onClick={() => onAction?.(rec.id)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#92400e] bg-[#fde68a] hover:bg-[#fcd34d] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {rec.actionLabel}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
