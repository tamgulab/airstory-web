/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Design tokens ported from DESIGN.md / the Apple-style mockups.
      // These are additive — existing Tailwind utility classes (bg-blue-600, etc.)
      // keep working unchanged. New/updated UI should prefer these names.
      colors: {
        primary: "#0071e3",
        brand: "#000000",
        canvas: "#f5f5f7",
        surface: "#ffffff",
        fg: "#1d1d1f",
        "on-primary": "#ffffff",
        muted: "#6e6e73",
        secondary: "#515154",
        link: "#0066cc",
        "link-dark": "#2997ff",
        hairline: "#d2d2d7",
        "hairline-soft": "#e8e8ed",
        aqi: {
          good: "#2e9e5b",
          moderate: "#c8930f",
          usg: "#d96a20",
          unhealthy: "#c62f27",
          "very-unhealthy": "#8e4b9e",
          hazardous: "#7a2233",
        },
      },
      fontSize: {
        hero: ["56px", { lineHeight: "60px", letterSpacing: "-0.28px", fontWeight: "600" }],
        section: ["40px", { lineHeight: "44px", fontWeight: "600" }],
        page: ["28px", { lineHeight: "32px", letterSpacing: "-0.3px", fontWeight: "600" }],
        tile: ["21px", { lineHeight: "26px", letterSpacing: "-0.2px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "25px", letterSpacing: "-0.374px" }],
        small: ["14px", { lineHeight: "18px", letterSpacing: "-0.224px" }],
        cap: ["12px", { lineHeight: "16px", letterSpacing: "-0.12px" }],
      },
      borderRadius: {
        ctrl: "8px",
        card: "18px",
        pill: "980px",
      },
      keyframes: {
        nudge: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(8px)" },
        },
      },
      animation: {
        nudge: "nudge 2s cubic-bezier(0.4,0,0.2,1) infinite",
      },
    },
  },
  plugins: [],
}
