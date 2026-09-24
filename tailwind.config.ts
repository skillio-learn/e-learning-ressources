import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          200: "#bfd3ff",
          300: "#93b4fd",
          400: "#608bfa",
          500: "#3b66f5",
          600: "#2547ea",
          700: "#1d36d7",
          800: "#1e2fae",
          900: "#1e2d89",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
