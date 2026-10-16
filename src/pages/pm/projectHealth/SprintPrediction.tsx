import React from 'react';
import { CalendarRange, TrendingUp, TrendingDown } from 'lucide-react';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import type { SprintPredictionData } from './healthCalculations';

interface SprintPredictionProps {
  prediction: SprintPredictionData;
}

export const SprintPrediction: React.FC<SprintPredictionProps> = ({ prediction }) => {
  const { sprintName, completedTasks, remainingTasks, completionPct, predictedPct, probability, confidence } = prediction;
  const predictedRemaining = Math.max(0, prediction.totalTasks - Math.round(prediction.totalTasks * predictedPct / 100));

  const probabilityColor = probability >= 75 ? '#059669' : probability >= 50 ? '#d97706' : '#dc2626';
  const probabilityBg = probability >= 75 ? '#d1fae5' : probability >= 50 ? '#fef3c7' : '#fee2e2';

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
        <h2 className="text-sm font-bold text-[#1a1d23] flex items-center gap-2 font-display">
          <CalendarRange className="w-4 h-4 text-[#0d9488]" />
          Iteration Prediction
        </h2>
        <ConfidenceIndicator confidence={confidence} compact />
      </div>

      <div className="mb-4">
        <div className="text-xs font-bold text-[#1a1d23] mb-1">{sprintName}</div>
        <div className="text-[10px] text-[#9ca3af]">
          {completedTasks} of {prediction.totalTasks} tasks completed
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-6 bg-[#f1f5f9] rounded-xl overflow-hidden mb-4">
        <div
          className="absolute top-0 left-0 h-6 rounded-xl"
          style={{ width: `${completionPct}%`, background: 'linear-gradient(90deg, #0d9488, #06b6d4)' }}
        />
        {predictedPct > completionPct && (
          <div
            className="absolute top-0 h-6 rounded-xl opacity-20"
            style={{
              left: `${completionPct}%`,
              width: `${predictedPct - completionPct}%`,
              background: 'linear-gradient(90deg, #0d9488, #06b6d4)',
              borderRight: '2px dashed #0d9488',
            }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-[#1a1d23] drop-shadow-sm">
            {completionPct}% complete
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9] text-center">
          <div className="text-lg font-bold text-[#059669]">{completedTasks}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#9ca3af]">Completed</div>
        </div>
        <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9] text-center">
          <div className="text-lg font-bold text-[#d97706]">{remainingTasks}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#9ca3af]">Remaining</div>
        </div>
        <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9] text-center">
          <div className="text-lg font-bold text-[#0d9488]">{predictedRemaining}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#9ca3af]">Predicted Left</div>
        </div>
      </div>

      {/* Prediction details */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] border border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          {predictedPct >= completionPct ? (
            <TrendingUp className="w-4 h-4 text-[#059669]" />
          ) : (
            <TrendingDown className="w-4 h-4 text-[#dc2626]" />
          )}
          <div>
            <div className="text-[10px] font-bold text-[#1a1d23]">
              Estimated final completion: {predictedPct}%
            </div>
            <div className="text-[9px] text-[#9ca3af]">Based on current velocity estimate</div>
          </div>
        </div>
        <div
          className="text-xs font-bold px-3 py-1 rounded-lg"
          style={{ color: probabilityColor, backgroundColor: probabilityBg }}
        >
          {probability}% likelihood of finishing
        </div>
      </div>
    </div>
  );
};
