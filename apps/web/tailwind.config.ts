import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          hover: "rgb(var(--color-primary-hover) / <alpha-value>)",
        },
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        textPrimary: "var(--color-text-primary)",
        textSecondary: "var(--color-text-secondary)",
        danger: "var(--color-danger)",
        scoreGreen: "var(--color-score-green)",
        scoreAmber: "var(--color-score-amber)",
        scoreRed: "var(--color-score-red)",
      },
    },
  },
  plugins: [],
};

export default config;
