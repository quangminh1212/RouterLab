// Teal-inspired color palette extracted from topup logo
// Light theme: cool mint/teal neutrals
// Dark theme: deep teal/charcoal tones

export const COLORS = {
  // Primary - Teal
  primary: {
    DEFAULT: "#187878",
    hover: "#146a6a",
    light: "#5FAEAE",
    dark: "#0F5C5C",
  },

  // Light theme backgrounds
  light: {
    bg: "#F3F8F8",
    bgAlt: "#E8F2F2",
    surface: "#FFFFFF",
    sidebar: "rgba(240, 248, 248, 0.82)",
    border: "rgba(0, 0, 0, 0.1)",
    textMain: "#132325",
    textMuted: "#4F6668",
  },

  // Dark theme backgrounds
  dark: {
    bg: "#0B1416",
    bgAlt: "#101C1F",
    surface: "#152226",
    sidebar: "rgba(16, 26, 30, 0.82)",
    border: "rgba(255, 255, 255, 0.1)",
    textMain: "#E8F3F3",
    textMuted: "#98AFB1",
  },

  // Status colors
  status: {
    success: "#22C55E",
    successLight: "#DCFCE7",
    successDark: "#166534",
    warning: "#F59E0B",
    warningLight: "#FEF3C7",
    warningDark: "#92400E",
    error: "#EF4444",
    errorLight: "#FEE2E2",
    errorDark: "#991B1B",
    info: "#3B82F6",
    infoLight: "#DBEAFE",
    infoDark: "#1E40AF",
  },
};

// CSS Variables mapping for Tailwind
export const CSS_VARIABLES = {
  light: {
    "--color-primary": COLORS.primary.DEFAULT,
    "--color-primary-hover": COLORS.primary.hover,
    "--color-bg": COLORS.light.bg,
    "--color-bg-alt": COLORS.light.bgAlt,
    "--color-surface": COLORS.light.surface,
    "--color-sidebar": COLORS.light.sidebar,
    "--color-border": COLORS.light.border,
    "--color-text-main": COLORS.light.textMain,
    "--color-text-muted": COLORS.light.textMuted,
  },
  dark: {
    "--color-primary": COLORS.primary.DEFAULT,
    "--color-primary-hover": COLORS.primary.hover,
    "--color-bg": COLORS.dark.bg,
    "--color-bg-alt": COLORS.dark.bgAlt,
    "--color-surface": COLORS.dark.surface,
    "--color-sidebar": COLORS.dark.sidebar,
    "--color-border": COLORS.dark.border,
    "--color-text-main": COLORS.dark.textMain,
    "--color-text-muted": COLORS.dark.textMuted,
  },
};
