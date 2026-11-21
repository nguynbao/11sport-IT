/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
        },
        accent: {
          500: "#06B6D4",
          600: "#0891B2",
        },
        brand: {
          dark: "#FFFFFF",
          slate: "#F8FAFC",
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Be Vietnam Pro", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.4rem" }],
        base: ["1.0625rem", { lineHeight: "1.55rem" }],
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],
        xl: ["1.3125rem", { lineHeight: "1.85rem" }],
        "2xl": ["1.625rem", { lineHeight: "2.15rem" }],
      },
    },
  },
  plugins: [],
};
