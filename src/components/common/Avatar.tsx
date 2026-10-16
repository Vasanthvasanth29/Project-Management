import React from 'react';
import { getInitials } from '../../utils/roleUtils';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  imageUrl?: string;
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
};

export const Avatar: React.FC<AvatarProps> = ({ name, color = '#0d9488', size = 'md', imageUrl, className = '' }) => {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`avatar ${sizeClasses[size]} object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`avatar ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </span>
  );
};
