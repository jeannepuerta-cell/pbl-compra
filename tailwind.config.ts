import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        verde: {
          DEFAULT: '#01423e',
          escuro: '#002e2b',
          claro: '#e6f0ef',
        },
        dourado: {
          DEFAULT: '#c39152',
          claro: '#f9f3ea',
          escuro: '#9a6e35',
        },
      },
    },
  },
  plugins: [],
};
export default config;
