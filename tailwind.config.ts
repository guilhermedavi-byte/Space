import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#080a0f",
        panel: "#10131a",
        line: "#252a35",
        accent: "#8b5cf6",
      },
      boxShadow: { glow: "0 0 40px rgb(139 92 246 / 0.12)" },
    },
  },
  plugins: [],
} satisfies Config;
