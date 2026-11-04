import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Card: React.FC<CardProps> = ({ className = '', children }) => (
  <div className={`rounded-xl border border-[#27272c] bg-[#161619] ${className}`}>{children}</div>
);

export const CardHeader: React.FC<CardHeaderProps> = ({ className = '', children }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

export const CardTitle: React.FC<CardTitleProps> = ({ className = '', children }) => (
  <h3 className={`text-2xl font-semibold leading-none tracking-tight text-white ${className}`}>{children}</h3>
);

export const CardContent: React.FC<CardContentProps> = ({ className = '', children }) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);
