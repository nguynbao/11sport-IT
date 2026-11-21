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
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        accent: {
          500: "#0EA5E9",
          600: "#0284C7",
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
