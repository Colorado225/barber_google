import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[#C9A45C] text-[#101010] border-transparent',
  secondary: 'bg-stone-800 text-stone-200 border-transparent',
  outline: 'border-stone-700 text-stone-300',
};

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
      variantClasses[variant],
      className,
    )}
    {...props}
  />
);
