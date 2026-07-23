import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b0f17",
          raised: "#111827",
          border: "#1f2937",
        },
      },
    },
  },
  plugins: [],
};

export default config;
