import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDirectory = path.join(root, "public");
const audioDirectory = path.join(publicDirectory, "audio");
const catalogPath = path.join(publicDirectory, "songs.json");
const supportedAudio = /\.(mp3|wav|m4a|ogg|aac)$/i;
const sourceFolders = [
  { name: "relli songs", label: "Relli songs", slug: "relli-songs" },
  { name: "movie songs", label: "Movie songs", slug: "movie-songs" },
  { name: "love failure songs", label: "Love Failure", slug: "love-failure" },
  { name: "rela re rela songs", label: "Rela Re Rela", slug: "rela-re-rela" },
];

function listAudioFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listAudioFiles(entryPath);
      return entry.isFile() && supportedAudio.test(entry.name) ? [entryPath] : [];
    })
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function publicAudioPath(fileUrl) {
  try {
    const pathname = decodeURIComponent(new URL(fileUrl, "http://localhost").pathname);
    if (!pathname.startsWith("/audio/")) return null;
    const filePath = path.resolve(publicDirectory, `.${pathname}`);
    return filePath.startsWith(`${audioDirectory}${path.sep}`) ? filePath : null;
  } catch {
    return null;
  }
}

function audioUrl(filePath) {
  const relativePath = path.relative(audioDirectory, filePath);
  return `/audio/${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`;
}

if (!fs.existsSync(audioDirectory)) fs.mkdirSync(audioDirectory, { recursive: true });

const songs = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const assetsByHash = new Map();
for (const filePath of listAudioFiles(audioDirectory)) {
  const fileHash = hashFile(filePath);
  if (!assetsByHash.has(fileHash)) assetsByHash.set(fileHash, filePath);
}

const songsByHash = new Map();
for (const song of songs) {
  const filePath = publicAudioPath(song.fileUrl);
  if (!filePath || !fs.existsSync(filePath)) continue;
  const fileHash = hashFile(filePath);
  if (!songsByHash.has(fileHash)) songsByHash.set(fileHash, song);
}

let imported = 0;
let reused = 0;

for (const folder of sourceFolders) {
  const sourceDirectory = path.join(root, folder.name);
  if (!fs.existsSync(sourceDirectory)) {
    throw new Error(`Song folder not found: ${sourceDirectory}`);
  }

  for (const sourcePath of listAudioFiles(sourceDirectory)) {
    const sourceName = path.basename(sourcePath);
    const fileHash = hashFile(sourcePath);
    let assetPath = assetsByHash.get(fileHash);

    if (!assetPath) {
      let destinationPath = path.join(audioDirectory, folder.slug, sourceName);
      if (fs.existsSync(destinationPath)) {
        destinationPath = path.join(audioDirectory, folder.slug, `${fileHash.slice(0, 12)}-${sourceName}`);
      }
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);
      assetPath = destinationPath;
      assetsByHash.set(fileHash, assetPath);
      imported += 1;
    } else {
      reused += 1;
    }

    const title = sourceName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    const song = songsByHash.get(fileHash);
    if (song) {
      Object.assign(song, { title, artist: "Vinayaka Chavithi DJ", category: folder.label });
      continue;
    }

    const newSong = {
      id: `folder-${folder.slug}-${fileHash.slice(0, 12)}`,
      title,
      artist: "Vinayaka Chavithi DJ",
      category: folder.label,
      duration: "DJ mix",
      fileUrl: audioUrl(assetPath),
      extension: path.extname(sourceName).toLowerCase(),
    };
    songs.push(newSong);
    songsByHash.set(fileHash, newSong);
  }
}

fs.writeFileSync(catalogPath, `${JSON.stringify(songs, null, 2)}\n`);
console.log(`Updated ${catalogPath}: ${songs.length} songs, ${imported} files copied, ${reused} existing audio files reused.`);