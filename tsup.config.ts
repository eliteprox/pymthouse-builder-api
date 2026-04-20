import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    format: "src/format.ts",
    env: "src/env.ts",
    device: "src/device.ts",
    verify: "src/verify.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
});
