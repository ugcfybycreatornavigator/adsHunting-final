export const authAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none p-0 bg-transparent",
    card: "w-full shadow-none p-0 bg-transparent border-none",
    header: "hidden",

    // Social Buttons (Google)
    socialButtonsBlockButton:
      "h-[48px] w-full border border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] text-[#18181B] font-semibold text-[14px] rounded-[10px] transition-colors shadow-none",
    socialButtonsBlockButtonText: "font-semibold text-[#18181B] text-[14px]",

    // Divider
    dividerRow: "my-6 flex items-center gap-3",
    dividerLine: "h-px bg-[#E4E4E7] flex-1",
    dividerText: "text-[11px] font-medium text-[#A1A1AA] uppercase tracking-[.1em]",

    // Forms
    form: "space-y-[20px]",
    formField: "space-y-2",
    formFieldLabel: "text-[13px] font-semibold text-[#18181B]",
    formFieldInput:
      "h-[48px] w-full rounded-[10px] border border-[#E4E4E7] bg-white px-4 text-[14px] text-[#18181B] shadow-none outline-none transition-all focus:border-[#68B32F] focus:ring-[3px] focus:ring-[#68B32F]/10",

    // Primary Button (Electric Blue)
    formButtonPrimary:
      "h-[48px] mt-2 w-full rounded-[10px] bg-[#68B32F] text-[14px] font-semibold text-white shadow-none transition-colors hover:bg-[#4F9223]",
    formButtonPrimaryIcon: "hidden",

    // Footer / Links
    footer: "mt-6 pt-4 text-center",
    footerActionText: "text-[14px] text-[#71717A]",
    footerActionLink: "ml-1.5 text-[14px] font-semibold text-[#68B32F] hover:text-[#4F9223] transition-colors",

    // Errors
    formFieldErrorText: "mt-1.5 text-[13px] font-medium text-[#EF4444]",
    alertText: "text-[#EF4444] text-[14px] font-medium",
    alert: "bg-red-50/50 border border-red-100 rounded-[10px] p-3",

    // OTP
    otpCodeFieldInput: "h-[50px] w-12 rounded-[10px] border border-[#E4E4E7] text-center text-[20px] font-bold text-[#18181B] transition-all focus:border-[#68B32F] focus:ring-[3px] focus:ring-[#68B32F]/10",

    identityPreviewText: "text-[14px] font-medium text-[#18181B]",
    identityPreviewEditButton: "ml-2 text-[14px] font-semibold text-[#68B32F] hover:text-[#4F9223] transition-colors",
  },
};
