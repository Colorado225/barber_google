import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => (
  <input
    className={`flex h-10 w-full rounded-md border border-[#29292e] bg-[#1c1c20] px-3 py-2 text-sm text-stone-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);
