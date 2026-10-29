// Unit tests for the sign-in flows, the redirect safety rules, the consent API and the
// middleware. Supabase is always mocked: no test talks to the network. Run: npm test
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://paritytrading.app/login/" } },
    css: false,
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
});
