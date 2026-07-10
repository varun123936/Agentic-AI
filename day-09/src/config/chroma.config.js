import { CloudClient } from 'chromadb';

let client = null;

// ── Chroma Cloud client ──────────────────────────────────────
// Uses CloudClient instead of ChromaClient — no local Docker needed
// Connects directly to trychroma.com using your API key
export function getChromaClient() {
  if (!client) {
    client = new CloudClient({
      apiKey: process.env.CHROMA_API_KEY,
      tenant: process.env.CHROMA_TENANT,
      database: process.env.CHROMA_DATABASE
    });
  }
  return client;
}

// Collection names — treat like table names
export const COLLECTIONS = {
  documents: 'document_chunks',
  tickets: 'support_tickets',
};

// ── Test Chroma Cloud connection on startup ───────────────────
export async function testChromaConnection() {
  try {
    const chroma = getChromaClient();

    // heartbeat() works the same way on CloudClient
    await chroma.heartbeat();

    console.log('✅ Chroma Cloud connected');
    console.log(`   Tenant:   ${process.env.CHROMA_TENANT}`);
    console.log(`   Database: ${process.env.CHROMA_DATABASE}`);

  } catch (error) {
    console.error('❌ Chroma Cloud connection failed:', error.message);
    console.error('Check CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE in .env');
    console.error('Get these from your dashboard at https://trychroma.com');
    // Don't exit — RAG is optional, rest of app still works
  }
}