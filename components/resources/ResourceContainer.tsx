import React from 'react';

export function ResourceContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-5 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
        {children}
      </div>
    </div>
  );
}
