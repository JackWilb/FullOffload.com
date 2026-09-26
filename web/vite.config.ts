import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // fulloffload.com is served from the domain root.
  base: "/",
  test: {
    include: ["src/**/*.test.ts"],
    // Removed once the parser suite lands (build step 5).
    passWithNoTests: true,
  },
});
