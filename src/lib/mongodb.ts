import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set in environment');

let cached: { client: MongoClient; indexesInitialized: boolean } | undefined;

async function ensureIndexes(client: MongoClient) {
  if (cached?.indexesInitialized) return;
  const db = client.db('nubmail');
  // Users
  await db.collection('users').createIndex({ email: 1 }, { unique: true, background: true });
  // Domains
  await db.collection('domains').createIndex({ userId: 1, createdAt: -1 }, { background: true });
  await db.collection('domains').createIndex({ verificationStatus: 1 }, { background: true });
  // Email accounts
  await db.collection('emailAccounts').createIndex({ userId: 1, createdAt: -1 }, { background: true });
  await db.collection('emailAccounts').createIndex({ emailAddress: 1 }, { unique: true, background: true });
  // Email messages
  await db.collection('emailMessages').createIndex({ userId: 1, sentAt: -1 }, { background: true });
  cached = { client, indexesInitialized: true };
}

export async function connectToDatabase() {
  if (cached) return cached.client;

  const client = new MongoClient(uri);
  await client.connect();
  cached = { client, indexesInitialized: false };
  // Fire-and-forget index initialization; don't block hot path unnecessarily
  ensureIndexes(client).catch(() => {});
  return client;
}

export async function getDb(dbName = 'nubmail') {
  const client = await connectToDatabase();
  return client.db(dbName);
}
