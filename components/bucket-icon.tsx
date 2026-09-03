import type { SVGProps } from "react";

export function BucketIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M12 3 L22 8 L12 13 L2 8 Z" />
      <path d="M2 8 L6 19 L12 22 L18 19 L22 8" />
      <path d="M12 13 L12 22" />
    </svg>
  );
}
