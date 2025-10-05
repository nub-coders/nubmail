import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set in environment');

let cached: { client: MongoClient } | undefined;

export async function connectToDatabase() {
  if (cached) return cached.client;

  const client = new MongoClient(uri);
  await client.connect();
  cached = { client };
  return client;
}

export async function getDb(dbName = 'nubmail') {
  const client = await connectToDatabase();
  return client.db(dbName);
}
