import React from 'react';

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked = false,
  onCheckedChange,
  className = '',
  onChange,
  disabled,
  ...props
}) => (
  <label
    data-state={checked ? 'checked' : 'unchecked'}
    className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center ${
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
    } ${className}`}
  >
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(event) => {
        onCheckedChange?.(event.target.checked);
        onChange?.(event);
      }}
      className="peer sr-only"
      {...props}
    />
    <span
      aria-hidden="true"
      className="relative h-6 w-11 rounded-full bg-[#27272c] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#C9A45C] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#C9A45C] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#101010]"
    />
  </label>
);
