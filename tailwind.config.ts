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
        // Top-anchored overlay toasts drop in from above (compositor-only).
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-20px) scale(0.9)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        shake: "shake 0.5s ease-in-out",
        float: "float 3s ease-in-out infinite",
        // NOTE: no fill-mode ("both") here on purpose. A retained transform
        // (fill-mode keeps the final keyframe forever) permanently turns every
        // message row into a stacking context and a fixed-position containing
        // block — which trapped the long-press dim backdrop inside its own row
        // (no full-screen phase-out) and let later rows paint over the open
        // action menu (options appearing under photo/video decks). Without it
        // rows revert to base styles (transform:none) once the entrance ends.
        "msg-in": "msg-in 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)",
        "toast-in": "toast-in 0.2s cubic-bezier(0.2, 0.9, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
