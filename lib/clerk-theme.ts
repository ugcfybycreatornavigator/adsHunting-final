export const authAppearance = {
  variables: {
    colorPrimary: "#5EA920",
    colorBackground: "#FEFFFD",
    colorForeground: "#0E1228",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#111827",
    colorText: "#0E1228",
    colorTextSecondary: "#65735F",
    colorDanger: "#E11D48",
    borderRadius: "0.5rem",
  },
  options: {
    animations: true,
    logoImageUrl: "/logo.png",
    logoLinkUrl: "/",
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full bg-transparent p-0 shadow-none",
    card: "w-full border-none bg-transparent p-0 shadow-none",
    header: "hidden",

    socialButtonsBlockButton:
      "h-[46px] min-h-[46px] w-full overflow-visible rounded-lg border border-[#DDE8D6] bg-white px-4 text-[13px] font-semibold text-[#111827] shadow-[0_1px_1px_rgba(43,83,27,0.04)] transition-all hover:border-[#BDD6B0] hover:bg-[#FAFDF7] focus:ring-2 focus:ring-[#5EA920]/20",
    socialButtonsBlockButtonText: "text-[13px] font-semibold text-[#111827]",

    dividerRow: "my-5 flex items-center gap-3",
    dividerLine: "h-px flex-1 bg-[#E3EDDD]",
    dividerText: "text-[10px] font-bold uppercase text-[#91A287]",

    form: "space-y-4",
    formField: "space-y-1.5",
    formFieldLabel: "text-[12px] font-semibold text-[#273149]",
    formFieldInput:
      "h-[46px] min-h-[46px] w-full rounded-lg border border-[#DDE8D6] bg-white px-4 text-[13px] font-medium leading-[46px] text-[#111827] shadow-[0_1px_2px_rgba(43,83,27,0.04)] outline-none transition-all placeholder:text-[#A6B49E] hover:border-[#C5DAB9] focus:border-[#5EA920] focus:ring-2 focus:ring-[#5EA920]/20",

    formButtonPrimary:
      "mt-1 h-11 w-full rounded-lg bg-[#5EA920] text-[13px] font-bold text-white shadow-[0_12px_24px_rgba(94,169,32,0.22)] transition-all hover:bg-[#4D8A1A] hover:shadow-[0_14px_28px_rgba(94,169,32,0.28)] focus:ring-2 focus:ring-[#5EA920]/25 active:translate-y-px",
    formButtonPrimaryIcon: "hidden",

    formFieldAction:
      "text-[12px] font-semibold text-[#4D8A1A] transition-colors hover:text-[#3D7213]",
    formResendCodeLink:
      "text-[12px] font-semibold text-[#4D8A1A] transition-colors hover:text-[#3D7213]",

    footer: "mt-7 pt-2 text-center",
    footerActionText: "text-[12px] text-[#7F8F78]",
    footerActionLink:
      "ml-1 text-[12px] font-bold text-[#4D8A1A] transition-colors hover:text-[#3D7213]",

    formFieldErrorText: "mt-1 text-[12px] font-semibold text-[#E11D48]",
    alert: "rounded-lg border border-[#FECACA] bg-[#FFF1F2] p-3",
    alertText: "text-[13px] font-semibold text-[#BE123C]",

    otpCodeFieldInput:
      "h-12 w-11 rounded-lg border border-[#DDE8D6] bg-white text-center text-[18px] font-bold text-[#0E1228] transition-all focus:border-[#5EA920] focus:ring-2 focus:ring-[#5EA920]/20",

    identityPreviewText: "text-[13px] font-semibold text-[#0E1228]",
    identityPreviewEditButton:
      "ml-2 text-[12px] font-bold text-[#4D8A1A] transition-colors hover:text-[#3D7213]",
  },
};
