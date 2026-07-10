import { getChromaClient, COLLECTIONS } from '../config/chroma.config.js';

// ── Get or create a Chroma Cloud collection ───────────────────
// Works identically to local ChromaDB — CloudClient has the same API
async function getCollection(collectionName) {
  const chroma = getChromaClient();

  const collection = await chroma.getOrCreateCollection({
    name: collectionName,
    embeddingFunction: null, // No embedding function needed — we provide embeddings directly
    metadata: {
      description: 'Document chunks for RAG',
      embedding_model: 'nomic-embed-text',
      created: new Date().toISOString()
    }
  });

  return collection;
}

// ── Store chunks with their embeddings ───────────────────────
export async function storeChunks(chunks) {
  console.log("Step 1: Getting collection...");

  const collection = await getCollection(COLLECTIONS.documents);

  console.log("Step 2: Collection obtained");

  const ids = chunks.map(c => c.id);
  const embeddings = chunks.map(c => c.embedding);
  const documents = chunks.map(c => c.text);
  const metadatas = chunks.map(c => c.metadata);

  console.log("Step 3: Adding to Chroma...");

  await collection.add({
    ids,
    embeddings,
    documents,
    metadatas
  });

  console.log("Step 4: Added successfully");
}

// ── Search for similar chunks ─────────────────────────────────
export async function searchSimilarChunks(queryEmbedding, options = {}) {

  const {
    topK = 5,
    userId = null,
    documentId = null,
    minScore = 0.3
  } = options;

  console.log("\n========== SEARCH ==========");

  const collection = await getCollection(COLLECTIONS.documents);

  console.log("Collection Count:", await collection.count());

  let whereFilter = {};

  if (userId && documentId) {
    whereFilter = {
      $and: [
        { userId: { $eq: userId } },
        { documentId: { $eq: documentId } }
      ]
    };
  } else if (userId) {
    whereFilter = {
      userId: { $eq: userId }
    };
  } else if (documentId) {
    whereFilter = {
      documentId: { $eq: documentId }
    };
  }

  console.log("Where Filter:");
  console.log(JSON.stringify(whereFilter, null, 2));

  const queryOptions = {
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ["documents", "metadatas", "distances"]
  };

  if (Object.keys(whereFilter).length > 0) {
    queryOptions.where = whereFilter;
  }

  console.log("\nQuery Options:");
  console.log(JSON.stringify(queryOptions, null, 2));

  const results = await collection.query(queryOptions);

  console.log("\n========== RAW CHROMA RESPONSE ==========");
  console.log(JSON.stringify(results, null, 2));

  const chunks = [];

  if (results.ids?.[0]) {

    for (let i = 0; i < results.ids[0].length; i++) {

      const distance = results.distances[0][i];
      const similarityScore = 1 - distance / 2;

      console.log("----------------------------");
      console.log("Chunk", i + 1);
      console.log("ID:", results.ids[0][i]);
      console.log("Distance:", distance);
      console.log("Similarity:", similarityScore);
      console.log("Metadata:", results.metadatas[0][i]);

      // if (similarityScore >= minScore) {

        chunks.push({
          id: results.ids[0][i],
          text: results.documents[0][i],
          metadata: results.metadatas[0][i],
          similarityScore
        });

      // }

    }

  }

  console.log("Returned Chunks:", chunks.length);
  console.log("=================================\n");

  return chunks;
}

// ── Delete all chunks for a document ─────────────────────────
export async function deleteDocumentChunks(documentId) {
  const collection = await getCollection(COLLECTIONS.documents);

  await collection.delete({
    where: { documentId: { $eq: documentId } }
  });
}

// ── Count chunks in collection ────────────────────────────────
export async function getCollectionStats() {
  const collection = await getCollection(COLLECTIONS.documents);
  const count = await collection.count();
  return { totalChunks: count };
}