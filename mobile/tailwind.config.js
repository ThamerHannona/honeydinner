/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");
/* global __filename */
const { C, fonts, shape } = require("jiti")(__filename)("./src/lib/theme.ts");
const adaptive = (key) => /^#[\da-f]{6}$/i.test(C[key] ?? '') ? `rgb(var(--color-${key}) / <alpha-value>)` : C[key];
const adaptiveColors = Object.fromEntries(Object.keys(C).map((key) => [key, adaptive(key)]));

module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  corePlugins: {
    space: false,
  },
  theme: {
    // NOTE to AI: You can extend the theme with custom colors or styles here.
    extend: {
      // For example, you can add a primary or secondary color here.
      colors: {
        ...adaptiveColors,
        white: adaptive('paper'),
        leaf: { DEFAULT: adaptive('brandGreen'), dark: adaptive('forest'), soft: adaptive('plateSage'), tint: adaptive('plateSage') },
        honey: { DEFAULT: adaptive('honey'), dark: adaptive('honeyText'), soft: adaptive('selectedCard') },
        cream: { DEFAULT: adaptive('cream'), deep: adaptive('quietFill'), line: adaptive('hairline') },
        ink: { DEFAULT: adaptive('ink'), soft: adaptive('inkSoft'), faint: adaptive('muted') },
        berry: { DEFAULT: adaptive('alert'), soft: adaptive('plateRose') },
      },
      fontFamily: {
        display: [fonts.display],
        "display-x": [fonts.display],
        "display-md": [fonts.display],
        "display-italic": [fonts.displayItalic],
        label: [fonts.label],
        logo: [fonts.logo],
        body: [fonts.body],
        "body-sb": [fonts.semibold],
        "body-b": [fonts.bold],
        "body-x": [fonts.bold],
      },
      borderRadius: { card: `${shape.card}px` },
      fontSize: {
        xs: "10px",
        sm: "12px",
        base: ["15px", { lineHeight: "22px" }],
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
        "4xl": "40px",
        "5xl": "48px",
        "6xl": "56px",
        "7xl": "64px",
        "8xl": "72px",
        "9xl": "80px",
      },
    },
  },
  darkMode: "class",
  plugins: [
    plugin(({ matchUtilities, theme }) => {
      const spacing = theme("spacing");

      // space-{n}  ->  gap: {n}
      matchUtilities(
        { space: (value) => ({ gap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-x-{n}  ->  column-gap: {n}
      matchUtilities(
        { "space-x": (value) => ({ columnGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );

      // space-y-{n}  ->  row-gap: {n}
      matchUtilities(
        { "space-y": (value) => ({ rowGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] }
      );
    }),
  ],
};

