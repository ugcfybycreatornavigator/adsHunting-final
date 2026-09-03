import React, { SVGProps } from "react";

export interface AdsHuntingLogoProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  variant?: "full" | "mark";
  surface?: "dark" | "light" | "auto";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function AdsHuntingLogo({
  variant = "full",
  surface = "auto",
  size = "md",
  className = "",
}: AdsHuntingLogoProps) {
  const isMark = variant === "mark";
  const isDarkSurface = surface === "dark";

  // Use the cropped logo images we generated
  const src = isMark ? "/logo-mark.png" : "/logo-full.png";

  const height = "50px";
  const width = isMark ? "50px" : "150px";

  return (
    <div
      className={`group inline-flex items-center gap-[10px] whitespace-nowrap overflow-visible ${className}`.trim()}
      aria-label="AdsHunting"
    >
      <img
        src={src}
        alt="AdsHunting Logo"
        className="flex-none transition-transform duration-200 group-hover:scale-[1.02] object-contain"
        style={{ height, width, filter: isDarkSurface ? "brightness(0) invert(1)" : "none" }}
      />
    </div>
  );
}
