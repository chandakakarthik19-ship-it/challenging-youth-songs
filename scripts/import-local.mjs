import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { GridFSBucket, MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "nadam";
const audioDirectory = path.resolve("public/audio");
const supportedAudio = /\.(mp3|wav|m4a|ogg|aac)$/i;

if (!uri) {
  console.error("MONGODB_URI is not configured in .env.local");
  process.exit(1);
}

const files = fs.readdirSync(audioDirectory)
  .filter((fileName) => supportedAudio.test(fileName))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

const client = new MongoClient(uri, { maxPoolSize: 4, serverSelectionTimeoutMS: 10000 });

try {
  await client.connect();
  const database = client.db(databaseName);
  const bucket = new GridFSBucket(database, { bucketName: "audio" });
  const songs = database.collection("songs");
  let imported = 0;
  let skipped = 0;

  console.log(`Found ${files.length} audio files. Uploading to MongoDB Atlas...`);

  for (const [index, fileName] of files.entries()) {
    const title = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    const existing = await songs.findOne({ title });
    if (existing) {
      skipped += 1;
      continue;
    }

    const filePath = path.join(audioDirectory, fileName);
    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: { originalName: fileName, source: "public/audio", contentType: audioContentType(fileName) },
    });
    await new Promise((resolve, reject) => {
      Readable.from(fs.createReadStream(filePath)).pipe(uploadStream).on("finish", resolve).on("error", reject);
    });
    await songs.insertOne({
      title,
      artist: "Vinayaka Chavithi DJ",
      category: "Festival mix",
      audioId: uploadStream.id,
      createdAt: new Date(),
    });
    imported += 1;

    if ((index + 1) % 10 === 0 || index === files.length - 1) {
      console.log(`${index + 1}/${files.length} processed`);
    }
  }

  console.log(`Done. Imported ${imported} songs and skipped ${skipped} existing songs into ${databaseName}.`);
} finally {
  await client.close();
}

function audioContentType(name) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "wav" ? "audio/wav" : extension === "m4a" ? "audio/mp4" : extension === "ogg" ? "audio/ogg" : "audio/mpeg";
}