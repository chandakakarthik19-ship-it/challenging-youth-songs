import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { MongoClient, GridFSBucket } from "mongodb";
import { unzipSync } from "fflate";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const zipPath = "C:\\Users\\chand\\Downloads\\Andhala Narasammo  djsomesh sripuram  cheyyi chusa.zip";
const outputDir = path.resolve("public/audio");
const category = "Rela Re Rela";
const supportedAudio = /\.(mp3|wav|m4a|ogg|aac)$/i;

if (!fs.existsSync(zipPath)) {
  console.error(`ZIP not found: ${zipPath}`);
  process.exit(1);
}

const zipBuffer = fs.readFileSync(zipPath);
const entries = Object.entries(unzipSync(new Uint8Array(zipBuffer))).filter(([name]) => supportedAudio.test(name));
if (!entries.length) {
  console.error("No supported audio files found in ZIP.");
  process.exit(1);
}

const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_FALLBACK;
if (!uri) {
  console.error("MONGODB_URI is not configured in .env.local");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const client = new MongoClient(uri, { maxPoolSize: 4, serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const database = client.db(process.env.MONGODB_DB ?? "nadam");
  const bucket = new GridFSBucket(database, { bucketName: "audio" });
  let added = 0;

  for (const [index, [entryName, value]] of entries.entries()) {
    const cleanName = (entryName.split("/").pop() || entryName).trim();
    const title = cleanName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    const safeName = `${String(index + 1).padStart(2, "0")}-${cleanName.replace(/[^a-z0-9.-]+/gi, "-")}`;
    const fileBuffer = Buffer.from(value);

    fs.writeFileSync(path.join(outputDir, safeName), fileBuffer);

    const uploadStream = bucket.openUploadStream(cleanName, {
      metadata: { originalName: cleanName, sourceArchive: path.basename(zipPath), contentType: audioContentType(cleanName), category },
    });

    await new Promise((resolve, reject) => {
      Readable.from(fileBuffer).pipe(uploadStream).on("finish", resolve).on("error", reject);
    });

    await database.collection("songs").insertOne({
      title,
      artist: "DJSomesh SRIPURAM",
      category,
      audioId: uploadStream.id,
      duration: "DJ mix",
      createdAt: new Date(),
    });

    console.log(`Stored: ${title} -> ${uploadStream.id.toString()}`);
    added += 1;
  }

  console.log(`Done. Added ${added} songs to MongoDB Atlas under category "${category}".`);
} finally {
  await client.close();
}

function audioContentType(name) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "wav" ? "audio/wav" : extension === "m4a" ? "audio/mp4" : extension === "ogg" ? "audio/ogg" : "audio/mpeg";
}
