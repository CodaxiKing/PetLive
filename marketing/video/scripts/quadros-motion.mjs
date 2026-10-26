// Renderiza quadros soltos do PetLive-Motion-30s para revisão visual.
// Uso: node scripts/quadros-motion.mjs 0 45 120 ...  (escala 0.5, em out/frames)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const quadros = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "PetLive-Motion-30s" });
for (const frame of quadros) {
  const output = path.resolve(`out/frames/f${String(frame).padStart(3, "0")}.png`);
  await renderStill({ composition, serveUrl, frame, output, scale: 0.5 });
  console.log(output);
}
