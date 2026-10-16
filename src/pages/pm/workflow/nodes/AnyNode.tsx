import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Sparkles, GitPullRequest } from 'lucide-react';
import type { AnyNodeData } from '../types';

export const AnyNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as AnyNodeData;
  const isSelected = selected || nodeData.isSelected;

  return (
    <div
      className={`relative group px-3.5 py-2 rounded-2xl bg-white border-2 border-dashed border-[#0891b2] text-[#0891b2] flex items-center gap-1.5 shadow-xs transition-all duration-200 cursor-pointer ${
        isSelected ? 'ring-3 ring-[#0891b2]/40 bg-[#ecfeff]' : 'hover:bg-[#f0fdfa]'
      }`}
    >
      <Sparkles className="w-3.5 h-3.5 text-[#0891b2]" />
      <span className="text-xs font-bold font-display uppercase tracking-wider">
        {nodeData.label || 'ANY'}
      </span>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#0891b2] !border-2 !border-white transition-transform group-hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-[#0891b2] !border-2 !border-white transition-transform group-hover:scale-125"
      />
    </div>
  );
});

AnyNode.displayName = 'AnyNode';
