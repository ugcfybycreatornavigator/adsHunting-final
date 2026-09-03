import React from 'react';
import { cn } from '@/lib/utils';

export function LandingContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10", className)}>
      {children}
    </div>
  );
}
