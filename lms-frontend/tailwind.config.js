/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Afacad Flux", "Inter", "system-ui", "sans-serif"],
        display: ["Afacad Flux", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Blue Theme
        "blue-theme": {
          50: "#FFFFFF",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        // Green Theme
        "green-theme": {
          50: "#FFFFFF",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        // Indigo Theme
        "indigo-theme": {
          50: "#FFFFFF",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Orange Theme
        "orange-theme": {
          50: "#FFFFFF",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          950: "#431407",
        },
        // Dark Professional Theme (inspired by resume design)
       "dark-theme": {
  50: "#FFFFFF",
  100: "#A0A0A0",
  200: "#e2e8f0",
  300: "#FFFFFF",
  400: "#9aa3b6",
  500: "#ccdaee",
  600: "#1e40af",
  700: "#334155",
  800: "#3a3a4b",
  900: "#FFFFFF",
  950: "#020617",
},
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        ".theme-primary": {
          color: "var(--theme-primary)",
        },
        ".theme-bg-primary": {
          backgroundColor: "var(--theme-primary)",
        },
        ".theme-bg": {
          backgroundColor: "var(--theme-bg)",
        },
        ".theme-bg-secondary": {
          backgroundColor: "var(--theme-bg-secondary)",
        },
        ".theme-text": {
          color: "var(--theme-text)",
        },
        ".theme-text-secondary": {
          color: "var(--theme-text-secondary)",
        },
        ".theme-border": {
          borderColor: "var(--theme-primary)",
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
