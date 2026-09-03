import { House, Compass, Radar, FolderHeart, Share2, HelpCircle, BookOpen, Settings } from "lucide-react";

export const navigationConfig = {
  primary: [
    { label: "Home", href: "/dashboard", icon: House },
    { label: "Discover", href: "/discover", icon: Compass, aliases: ["/brands"] },
  ],
  research: [
    { label: "Competitors", href: "/competitors", icon: Radar },
  ],
  swipeFiles: [
    { label: "Swipe Files", href: "/swipe-files", icon: FolderHeart },
  ],
  shared: [
    { label: "Shared Ads", href: "/shared-ads", icon: Share2 },
  ],
  support: [
    { label: "Support", href: "#", icon: HelpCircle, isModal: true },
    { label: "FAQ", href: "/faq", icon: BookOpen },
    { label: "Settings", href: "/settings", icon: Settings },
  ]
};
