import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"] },
      boxShadow: { glow: "0 0 0 2px #F97316, 0 0 22px 4px rgba(249,115,22,0.45)" },
      keyframes: {
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(249,115,22,0.55)" }, "100%": { boxShadow: "0 0 0 14px rgba(249,115,22,0)" } },
        slideIn: { "0%": { opacity: "0", transform: "translateX(-24px)" }, "100%": { opacity: "1", transform: "none" } },
      },
      animation: { pulseRing: "pulseRing 1.2s ease-out infinite", slideIn: "slideIn 0.45s ease-out" },
    },
  },
  plugins: [],
};

export default config;
