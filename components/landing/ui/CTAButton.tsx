import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CTAButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'inverted';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function CTAButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: CTAButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-brand text-white hover:bg-brand-strong',
    secondary: 'bg-surface-blue text-brand-strong hover:bg-brand-soft',
    outline: 'border border-border-strong text-text-primary hover:bg-surface-subtle',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle',
    inverted: 'bg-white text-brand-strong hover:bg-surface-subtle',
  };
  
  const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-6 text-[15px]',
    lg: 'h-14 px-8 text-lg',
  };

  const classes = cn(baseStyles, variants[variant], sizes[size], className);

  if (href) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Link href={href} className={classes} {...(props as any)}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
