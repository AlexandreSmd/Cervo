/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        good: "#1FA971",
        mid: "#F2A33A",
        bad: "#E5484D",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', "system-ui", "sans-serif"],
        sans: ['"DM Sans Variable"', "system-ui", "sans-serif"],
      },
      maxWidth: { app: "520px", admin: "1320px" },
      // Ombre « imprimée » : un aplat d'encre décalé, pas de flou.
      boxShadow: { hard: "3px 3px 0 0 rgb(var(--ink))", "hard-sm": "2px 2px 0 0 rgb(var(--ink))" },
      // Coins moins ronds que la moyenne des applis : plus net, plus « papier ».
      borderRadius: { lg: "10px", xl: "12px", "2xl": "16px", "3xl": "20px" },
    },
  },
  plugins: [],
};
