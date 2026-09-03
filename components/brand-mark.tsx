import Link from "next/link";
import { AdsHuntingLogo } from "@/components/brand/AdsHuntingLogo";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/dashboard",
  className,
  inverted = false,
  compact = false,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link 
      href={href} 
      className={cn(
        "inline-flex items-center min-w-0 flex-shrink-0 transition-opacity hover:opacity-90", 
        className
      )} 
      aria-label={`${BRAND.name} Home`}
    >
      <AdsHuntingLogo 
        variant={compact ? "mark" : "full"} 
        surface={inverted ? "dark" : "light"} 
        size="md" 
      />
    </Link>
  );
}
