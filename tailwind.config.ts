import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 简洁素雅的主色调 - 温暖的纸张色系
        paper: {
          50: "#faf9f7",
          100: "#f5f3f0",
          200: "#e8e4de",
          300: "#d4cec5",
          400: "#a8a097",
          500: "#7a7268",
          600: "#5c554d",
          700: "#443e38",
          800: "#2d2925",
          900: "#1a1815",
        },
        ink: {
          DEFAULT: "#2d2925",
          light: "#5c554d",
          muted: "#a8a097",
        },
        accent: {
          DEFAULT: "#8b7355",
          light: "#a8927a",
          dark: "#6b5840",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Noto Serif SC", "serif"],
        sans: ["system-ui", "-apple-system", "Noto Sans SC", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
