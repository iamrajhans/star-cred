/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` must match the GitHub Pages repo path so assets resolve correctly.
// Served at https://iamrajhans.github.io/star-cred/.
export default defineConfig({
  base: "/star-cred/",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
