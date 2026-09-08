import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#031246",
          purple: "#7F1BB0",
          indigo: "#3C3380",
          lightBg: "#F7F4FE",
          darkBg: "#020205",
          slate: "#CBD5E3",
          cardDark: "#070E28",
          cardBorderDark: "#1E2958",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
