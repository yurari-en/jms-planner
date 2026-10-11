import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { focusRing } from './styles';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'default';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accentStrong text-white border-accentStrong hover:brightness-110',
  default: 'bg-surface2 text-text border-border hover:border-accent',
  ghost: 'bg-transparent text-text border-transparent hover:bg-surface2',
  danger: 'bg-transparent text-effRed border-effRed/60 hover:bg-effRed/10',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
});

export default Button;
