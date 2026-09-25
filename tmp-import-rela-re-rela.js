const fs = require('fs');
const path = require('path');
const { Readable } = require('node:stream');
const { MongoClient, GridFSBucket } = require('mongodb');
const { unzipSync } = require('fflate');
require('dotenv').config({ path: '.env.local' });

const zipPath = 'C:\\Users\\chand\\Downloads\\Andhala Narasammo  djsomesh sripuram  cheyyi chusa.zip';
const outputDir = path.resolve('public/audio');
const category = 'Rela Re Rela';
const supportedAudio = /\.(mp3|wav|m4a|ogg|aac)$/i;

const zipBuffer = fs.readFileSync(zipPath);
const files = Object.entries(unzipSync(new Uint8Array(zipBuffer))).filter(([name]) => supportedAudio.test(name));
if (!files.length) {
  console.error('No supported audio files found in ZIP.');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_FALLBACK;
if (!uri) {
  console.error('MONGODB_URI is not configured.');
  process.exit(1);
}

(async () => {
  const client = new MongoClient(uri, { maxPoolSize: 4, serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const database = client.db(process.env.MONGODB_DB ?? 'nadam');
  const bucket = new GridFSBucket(database, { bucketName: 'audio' });
  let added = 0;

  for (const [index, [entryName, value]] of files.entries()) {
    const cleanName = (entryName.split('/').pop() || entryName).replace(/[\\/]+/g, ' ').trim();
    const extension = path.extname(cleanName).toLowerCase();
    const safeName = `${String(index + 1).padStart(2, '0')}-${cleanName.replace(/[^a-z0-9.-]+/gi, '-')}`;
    const upload = Buffer.from(value);
    const destPath = path.join(outputDir, safeName);
    fs.writeFileSync(destPath, upload);

    const title = cleanName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    const uploadStream = bucket.openUploadStream(cleanName, { metadata: { originalName: cleanName, contentType: audioContentType(cleanName), sourceArchive: path.basename(zipPath), category } });
    await new Promise((resolve, reject) => {
      Readable.from(upload).pipe(uploadStream).on('finish', resolve).on('error', reject);
    });
    await database.collection('songs').insertOne({
      title,
      artist: 'DJSomesh SRIPURAM',
      category,
      audioId: uploadStream.id,
      duration: 'DJ mix',
      createdAt: new Date(),
    });
    console.log(`Stored: ${title} -> /api/songs/${uploadStream.id.toString()}`);
    added += 1;
  }

  console.log(`Done. Added ${added} songs to MongoDB Atlas under category "${category}".`);
  await client.close();
})().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});

function audioContentType(name) {
  const extension = name.toLowerCase().split('.').pop();
  return extension === 'wav' ? 'audio/wav' : extension === 'm4a' ? 'audio/mp4' : extension === 'ogg' ? 'audio/ogg' : 'audio/mpeg';
}
