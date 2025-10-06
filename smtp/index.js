// Minimal SMTP receiver that parses inbound messages and stores them in MongoDB
// Uses smtp-server and mailparser. Intended to run as a sidecar service.

const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const { MongoClient } = require('mongodb');

const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 25; // container port
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://nubmail:nubmail@mongodb:27017/nubmail?authSource=admin';

let mongoClient;

async function getDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
    });
    await mongoClient.connect();
  }
  return mongoClient.db();
}

function extractAddresses(addressObject) {
  if (!addressObject || !Array.isArray(addressObject.value)) return [];
  return addressObject.value
    .map((addr) => (addr && addr.address ? String(addr.address).toLowerCase() : null))
    .filter(Boolean);
}

const server = new SMTPServer({
  // We accept unauthenticated inbound from the internet (MX). Do not enable auth here.
  disabledCommands: ['AUTH'],
  logger: false,
  onConnect(session, callback) {
    // Optionally restrict by IPs or use a blocklist here.
    return callback();
  },
  onData(stream, session, callback) {
    (async () => {
      try {
        const parsed = await simpleParser(stream);

        const fromAddresses = extractAddresses(parsed.from);
        const toAddresses = extractAddresses(parsed.to).concat(extractAddresses(parsed.cc)).concat(extractAddresses(parsed.bcc));

        const sender = fromAddresses[0] || (parsed.from && parsed.from.text) || 'unknown@unknown';
        const recipients = Array.from(new Set(toAddresses));

        const subject = parsed.subject || '';
        const html = parsed.html ? (typeof parsed.html === 'string' ? parsed.html : String(parsed.html)) : undefined;
        const text = parsed.text || (html ? '' : '');
        const body = html || text || '';
        const sentAt = parsed.date ? new Date(parsed.date) : new Date();

        const db = await getDb();
        const emailMessages = db.collection('emailMessages');

        await emailMessages.insertOne({
          sender,
          recipients: recipients.length > 0 ? recipients : [],
          subject,
          body,
          sentAt,
          read: false,
          inbound: true,
        });

        callback();
      } catch (err) {
        console.error('SMTP onData error:', err);
        callback(err);
      }
    })();
  },
});

server.on('error', (err) => {
  console.error('SMTP server error:', err);
});

server.listen(SMTP_PORT, '0.0.0.0', () => {
  console.log(`SMTP server listening on 0.0.0.0:${SMTP_PORT}`);
});

process.on('SIGTERM', async () => {
  try {
    await server.close();
  } catch {}
  try {
    if (mongoClient) await mongoClient.close();
  } catch {}
  process.exit(0);
});


