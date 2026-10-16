import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCircle2 } from 'lucide-react';
import type { DoneNodeData } from '../types';

export const DoneNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DoneNodeData;
  const isSelected = selected || nodeData.isSelected;

  return (
    <div
      className={`relative group px-4 py-2.5 rounded-2xl bg-[#059669] text-white flex items-center gap-2 shadow-sm transition-all duration-200 cursor-pointer min-w-[120px] justify-center ${
        isSelected ? 'ring-3 ring-[#10b981] shadow-md scale-105' : 'hover:bg-[#047857]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-[#059669] transition-transform group-hover:scale-125"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-[#059669] transition-transform group-hover:scale-125"
      />

      <CheckCircle2 className="w-4 h-4 text-emerald-100" />
      <span className="text-xs font-bold tracking-wide font-display">
        {nodeData.label || 'Done'}
      </span>
    </div>
  );
});

DoneNode.displayName = 'DoneNode';
