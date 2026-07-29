import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svgPath = path.join(rootDir, "public", "pwa-icon.svg");
const svgBuffer = readFileSync(svgPath);

const targets = [
  { size: 180, file: "apple-touch-icon.png" },
  { size: 192, file: "pwa-icon-192.png" },
  { size: 512, file: "pwa-icon-512.png" },
];

for (const { size, file } of targets) {
  const outputPath = path.join(rootDir, "public", file);
  await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
  console.log(`gerado: public/${file} (${size}x${size})`);
}
