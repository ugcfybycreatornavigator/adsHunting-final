import React, { HTMLAttributes } from "react";

export interface AdsHuntingLogoProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "full" | "mark";
  surface?: "dark" | "light" | "auto";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function AdsHuntingLogo({
  variant = "full",
  surface = "auto",
  size = "md",
  className = "",
  ...props
}: AdsHuntingLogoProps) {
  void variant;
  void surface;

  const sizeClass = {
    xs: "h-12 w-24",
    sm: "h-14 w-28",
    md: "h-16 w-32",
    lg: "h-20 w-40",
    xl: "h-24 w-48",
  }[size];

  return (
    <div
      className={`group inline-flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden ${className}`.trim()}
      aria-label="AdsHunting"
      {...props}
    >
      <img
        src="/logo.png"
        alt="AdsHunting Logo"
        className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
      />
    </div>
  );
}
