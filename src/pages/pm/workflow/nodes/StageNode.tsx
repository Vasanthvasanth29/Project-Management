import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StageNodeData } from '../types';

export const StageNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as StageNodeData;
  const { stage } = nodeData;
  const isSelected = selected || nodeData.isSelected;

  return (
    <div
      className={`relative group px-4 py-2.5 rounded-xl bg-white border transition-all duration-200 cursor-pointer shadow-xs min-w-[130px] max-w-[170px] flex items-center gap-2.5 justify-center ${
        isSelected
          ? 'border-[#1a73e8] ring-2 ring-[#1a73e8]/30 shadow-md bg-white'
          : 'border-[#e0e2ec] hover:border-[#1a73e8]/60 hover:shadow-sm'
      }`}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-[#1a73e8] !border-2 !border-white transition-transform group-hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-[#1a73e8] !border-2 !border-white transition-transform group-hover:scale-125"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-2 !h-2 !bg-[#1a73e8] !border-2 !border-white transition-transform group-hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-2 !h-2 !bg-[#1a73e8] !border-2 !border-white transition-transform group-hover:scale-125"
      />

      {/* Status Dot & Stage Name */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs"
        style={{ backgroundColor: stage?.color || '#2563eb' }}
      />
      <span className="text-xs font-bold text-[#1f1f1f] truncate font-display tracking-tight">
        {stage?.name || 'Stage'}
      </span>
    </div>
  );
});

StageNode.displayName = 'StageNode';
