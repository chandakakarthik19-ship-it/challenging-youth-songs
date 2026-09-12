import fs from "node:fs";
import path from "node:path";
import { createExtractorFromData } from "node-unrar-js";

const archivePath = process.argv[2];
const supportedAudio = /\.(mp3|wav|m4a|ogg|aac)$/i;
if (!archivePath) {
  console.error("Usage: node scripts/extract-rar-local.mjs <path-to-rar>");
  process.exit(1);
}

const outputDirectory = path.resolve("public/audio");
fs.mkdirSync(outputDirectory, { recursive: true });
const archive = Uint8Array.from(fs.readFileSync(archivePath)).buffer;
const extractor = await createExtractorFromData({ data: archive });
const extracted = extractor.extract({ files: (header) => supportedAudio.test(header.name) });
const songs = [];

for (const [index, file] of [...extracted.files].entries()) {
  if (!file.extraction) continue;
  const originalName = path.basename(file.fileHeader.name);
  const extension = path.extname(originalName).toLowerCase();
  const safeName = `${String(index + 1).padStart(2, "0")}-${originalName.replace(/[^a-z0-9.-]+/gi, "-")}`;
  fs.writeFileSync(path.join(outputDirectory, safeName), Buffer.from(file.extraction));
  songs.push({
    id: `local-${index + 1}`,
    title: originalName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
    artist: "Vinayaka Chavithi DJ",
    category: "Festival mix",
    duration: "DJ mix",
    fileUrl: `/audio/${encodeURIComponent(safeName)}`,
    extension,
  });
  console.log(`${songs.length} extracted: ${originalName}`);
}

fs.writeFileSync("public/songs.json", JSON.stringify(songs, null, 2));
console.log(`Done. Extracted ${songs.length} playable songs to public/audio.`);
