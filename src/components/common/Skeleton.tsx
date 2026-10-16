import React from 'react';

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
);

export const SkeletonText: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

export const StatCardSkeleton: React.FC = () => (
  <div className="card p-5">
    <div className="flex items-center justify-between mb-4">
      <SkeletonBlock className="w-10 h-10 rounded-xl" />
      <SkeletonBlock className="w-12 h-5 rounded-full" />
    </div>
    <SkeletonText className="w-16 h-7 mb-2" />
    <SkeletonText className="w-24 h-4" />
  </div>
);

export const ProjectCardSkeleton: React.FC = () => (
  <div className="card p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <SkeletonText className="w-48 h-5 mb-2" />
        <SkeletonText className="w-32 h-4" />
      </div>
      <SkeletonBlock className="w-20 h-6 rounded-full" />
    </div>
    <SkeletonBlock className="w-full h-2 rounded-full mb-4" />
    <div className="flex gap-4">
      <SkeletonText className="w-20 h-4" />
      <SkeletonText className="w-20 h-4" />
    </div>
  </div>
);

export const TaskRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100">
    <SkeletonBlock className="w-4 h-4 rounded" />
    <SkeletonText className="flex-1 h-4" />
    <SkeletonText className="w-20 h-5 rounded-full" />
    <SkeletonText className="w-24 h-4" />
    <SkeletonBlock className="w-7 h-7 rounded-full" />
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <SkeletonText className="w-48 h-7 mb-2" />
      <SkeletonText className="w-64 h-5" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[...Array(2)].map((_, i) => <ProjectCardSkeleton key={i} />)}
    </div>
  </div>
);
