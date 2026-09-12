import { GridFSBucket, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 };

if (!uri) console.warn("MONGODB_URI is not set. The app will use its demo playlist.");

const globalForMongo = globalThis as unknown as { mongoClientPromise?: Promise<MongoClient> };

export const clientPromise = uri
  ? globalForMongo.mongoClientPromise ?? (globalForMongo.mongoClientPromise = new MongoClient(uri, options).connect())
  : null;

export async function getDatabase() {
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "nadam");
}

export async function getAudioBucket() {
  const database = await getDatabase();
  return database ? new GridFSBucket(database, { bucketName: "audio" }) : null;
}