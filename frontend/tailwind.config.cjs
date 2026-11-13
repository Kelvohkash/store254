module.exports = {
  content: ["./*.html", "./scripts/**/*.js", "./src/**/*.ts"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#059669",
          dark: "#047857",
          light: "#d1fae5",
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
