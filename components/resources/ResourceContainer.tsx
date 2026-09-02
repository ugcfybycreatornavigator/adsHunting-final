import React from 'react';

export function ResourceContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full pt-24 md:pt-32">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-5 md:px-6 lg:px-8 pb-12 md:pb-16 lg:pb-20">
        {children}
      </div>
    </div>
  );
}
