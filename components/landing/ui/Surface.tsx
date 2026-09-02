import React from 'react';
import { cn } from '@/lib/utils';

export function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-surface border border-border rounded-[14px] overflow-hidden", className)}>
      {children}
    </div>
  );
}
