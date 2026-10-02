import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: "#2C2C2A",
        canvas: "var(--bg)",
        surface: "var(--surface)",
        card: "var(--card)",
        wine: {
          DEFAULT: "var(--wine)",
          light: "var(--wine-l)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          light: "var(--gold-l)",
        },
        cream: {
          DEFAULT: "var(--cream)",
          soft: "var(--cream-2)",
        },
        muted: "var(--muted)",
        border: "var(--border)",
        ink: "var(--ink)",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
        serif: ["var(--font-fraunces)", "serif"],
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        shake: "shake 0.5s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
