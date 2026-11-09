/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Geologica", "system-ui", "sans-serif"] },
      colors: {
        cream: "#F8F3EA",
        ink: "#3F312B",
        reserved: "#F2C5B8",
        booked: "#A9705F",
        returned: "#3E2F2A",
        cleaning: "#A8452A",
        cell: "#E3E1DE",
      },
    },
  },
  plugins: [],
};
