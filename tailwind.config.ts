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
        sans: ['"Stack Sans Text Variable"', '"Stack Sans Text"', "sans-serif"],
        serif: ['"Stack Sans Text Variable"', '"Stack Sans Text"', "sans-serif"],
        notch: ['"Stack Sans Notch"', "sans-serif"],
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "msg-in": {
          "0%": { opacity: "0", transform: "translateY(20px) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // Opacity-only page/tab fades: compositor work, no JS per frame and no
        // transform that would force backdrop-filter re-blur on every screen.
        "page-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "nav-fade": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        shake: "shake 0.5s ease-in-out",
        float: "float 3s ease-in-out infinite",
        "msg-in": "msg-in 0.25s cubic-bezier(0.2, 0.9, 0.3, 1) both",
        "page-in": "page-in 0.12s ease-out both",
        "nav-fade": "nav-fade 0.14s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
