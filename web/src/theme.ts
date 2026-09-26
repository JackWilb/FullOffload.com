// The whole design system (design system artifact: "Full Offload", theme.ts). This is the only
// place Mantine is customized; components use props, never styles or classNames.
import {
  createTheme,
  virtualColor,
  type MantineColorsTuple,
} from "@mantine/core";

// Primary. Light mode fills with [6], dark mode with [5] (see primaryShade).
const brand: MantineColorsTuple = [
  "#eef0ff",
  "#dde1ff",
  "#bac2ff",
  "#95a0fb",
  "#808bf7",
  "#5b63ea",
  "#4f55e0",
  "#4145c4",
  "#3538a0",
  "#2a2d7e",
];

// Zinc-tinted neutrals for light mode. [4] (input borders) and [6] (dimmed text)
// are darker than Mantine's defaults so they pass WCAG contrast on white.
const gray: MantineColorsTuple = [
  "#fafafa",
  "#f4f4f5",
  "#e4e4e7",
  "#d4d4d8",
  "#8b8b94",
  "#71717a",
  "#5f5f68",
  "#3f3f46",
  "#27272a",
  "#18181b",
];

// Dark-mode neutrals. [0] text, [2] dimmed, [4] borders, [6] inputs, [7] page.
const dark: MantineColorsTuple = [
  "#d4d4d8",
  "#b4b4bb",
  "#9a9aa3",
  "#71717a",
  "#52525b",
  "#2e2e33",
  "#27272a",
  "#1c1c1f",
  "#141416",
  "#0b0b0c",
];

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 5 },
  autoContrast: true,

  colors: {
    brand,
    gray,
    dark,
    // Semantic names. Use these in components, never the raw palette names.
    verified: virtualColor({ name: "verified", light: "brand", dark: "brand" }),
    unverified: virtualColor({
      name: "unverified",
      light: "gray",
      dark: "gray",
    }),
    success: virtualColor({ name: "success", light: "green", dark: "green" }),
    warning: virtualColor({ name: "warning", light: "yellow", dark: "yellow" }),
    danger: virtualColor({ name: "danger", light: "red", dark: "red" }),
  },

  black: "#09090b",
  white: "#ffffff",

  fontFamily:
    '"Geist Variable", Geist, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontFamilyMonospace:
    '"Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  headings: {
    fontFamily:
      '"Geist Variable", Geist, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontWeight: "600",
  },

  defaultRadius: "md",
  cursorType: "pointer",
  // spacing, fontSizes, lineHeights, radius scale and breakpoints: Mantine defaults.
});
