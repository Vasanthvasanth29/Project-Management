import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import type { StartNodeData } from '../types';

export const StartNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as StartNodeData;
  const isSelected = selected || nodeData.isSelected;

  return (
    <div
      className={`relative group px-4 py-2 rounded-full bg-[#1e293b] text-white flex items-center gap-2 shadow-sm transition-all duration-200 cursor-pointer ${
        isSelected ? 'ring-3 ring-[#1a73e8] shadow-md scale-105' : 'hover:bg-[#0f172a]'
      }`}
    >
      <div className="w-5 h-5 rounded-full bg-[#3b82f6] flex items-center justify-center text-white">
        <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
      </div>
      <span className="text-xs font-bold tracking-wider uppercase font-display">
        {nodeData.label || 'START'}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-[#3b82f6] !border-2 !border-white transition-transform group-hover:scale-125"
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';
