import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { MongoClient, GridFSBucket } from "mongodb";
import { createExtractorFromData } from "node-unrar-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const archivePath = process.argv[2];
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "nadam";
const supportedAudio = /\.(mp3|wav|m4a|ogg|aac)$/i;

if (!archivePath || !uri) {
  console.error("Usage: node scripts/import-rar.mjs <path-to-rar>");
  process.exit(1);
}

const archive = Uint8Array.from(fs.readFileSync(archivePath)).buffer;
console.log(`Reading ${path.basename(archivePath)}...`);
const extractor = await createExtractorFromData({ data: archive });
const extracted = extractor.extract({ files: (header) => supportedAudio.test(header.name) });
const files = [...extracted.files].filter((file) => file.extraction);
console.log(`Found ${files.length} audio files. Uploading to MongoDB Atlas...`);

const client = new MongoClient(uri, { maxPoolSize: 4, serverSelectionTimeoutMS: 10000 });
await client.connect();
const database = client.db(databaseName);
const bucket = new GridFSBucket(database, { bucketName: "audio" });
const songs = [];

for (const [index, file] of files.entries()) {
  const originalName = path.basename(file.fileHeader.name);
  const title = originalName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const uploadStream = bucket.openUploadStream(originalName, {
    metadata: { originalName, sourceArchive: path.basename(archivePath), contentType: audioContentType(originalName) },
  });
  await new Promise((resolve, reject) => Readable.from(Buffer.from(file.extraction)).pipe(uploadStream).on("finish", resolve).on("error", reject));
  songs.push({ title, artist: "Vinayaka Chavithi DJ", category: "Festival mix", audioId: uploadStream.id, createdAt: new Date() });
  if ((index + 1) % 10 === 0 || index === files.length - 1) console.log(`${index + 1}/${files.length} uploaded`);
}

if (songs.length) await database.collection("songs").insertMany(songs);
await client.close();
console.log(`Done. Imported ${songs.length} songs into ${databaseName}.`);

function audioContentType(name) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "wav" ? "audio/wav" : extension === "m4a" ? "audio/mp4" : extension === "ogg" ? "audio/ogg" : "audio/mpeg";
}
