import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ className = '', disabled, ...props }) => (
  <button
    className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#C9A45C] text-[#101010] hover:bg-[#E5C378] ${className}`}
    disabled={disabled}
    {...props}
  />
);
