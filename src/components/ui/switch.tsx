import React from 'react';

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked = false, onCheckedChange, className = '', ...props }) => (
  <input
    type="checkbox"
    role="switch"
    checked={checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    className={`peer h-[6px] w-[12px] shrink-0 cursor-pointer appearance-none rounded-full border border-transparent bg-[#27272c] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9A45c] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#C9A45C] ${className}`}
    {...props}
  />
);