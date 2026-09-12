import { GridFSBucket, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const fallbackUri = process.env.MONGODB_URI_FALLBACK;
const options = { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 };

if (!uri) console.warn("MONGODB_URI is not set. The app will use its demo playlist.");

const globalForMongo = globalThis as unknown as { mongoClientsPromise?: Promise<MongoClient[]> };

async function connectToMongo(connectionUri: string) {
  return new MongoClient(connectionUri, options).connect();
}

export type MongoStorage = {
  database: ReturnType<MongoClient["db"]>;
  bucket: GridFSBucket;
};

const configuredUris = [uri, fallbackUri].filter((value): value is string => Boolean(value));

const clientsPromise = configuredUris.length
  ? globalForMongo.mongoClientsPromise ?? (globalForMongo.mongoClientsPromise = Promise.allSettled(configuredUris.map(connectToMongo)).then((results) => {
      const clients = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      if (!clients.length) throw results.find((result) => result.status === "rejected")?.reason ?? new Error("MongoDB is not reachable");
      return clients;
    }))
  : null;

export const clientPromise = clientsPromise?.then(([client]) => client) ?? null;

export async function getStorageTargets(): Promise<MongoStorage[]> {
  if (!clientsPromise) return [];
  const clients = await clientsPromise;
  return clients.map((client) => {
    const database = client.db(process.env.MONGODB_DB ?? "nadam");
    return { database, bucket: new GridFSBucket(database, { bucketName: "audio" }) };
  });
}

export async function getDatabase() {
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB ?? "nadam");
}

export async function getAudioBucket() {
  const [storage] = await getStorageTargets();
  return storage?.bucket ?? null;
}