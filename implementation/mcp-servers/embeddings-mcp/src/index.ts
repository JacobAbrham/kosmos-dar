/**
 * Embeddings MCP Server - Vector embedding generation for KOSMOS agents
 * Supports OpenAI, Anthropic (via Voyage), and local models
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";

const config = {
  openaiKey: process.env.OPENAI_API_KEY || "",
  voyageKey: process.env.VOYAGE_API_KEY || "",
  cohereKey: process.env.COHERE_API_KEY || "",
  defaultProvider: process.env.EMBEDDING_PROVIDER || "openai",
  defaultModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
};

const openai = new OpenAI({ apiKey: config.openaiKey });

const TOOLS: Tool[] = [
  {
    name: "embed_text",
    description: "Generate embeddings for text.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to embed" },
        provider: { type: "string", enum: ["openai", "voyage", "cohere"], description: "Embedding provider" },
        model: { type: "string", description: "Model name (e.g., text-embedding-3-small)" },
      },
      required: ["text"],
    },
  },
  {
    name: "embed_batch",
    description: "Generate embeddings for multiple texts.",
    inputSchema: {
      type: "object",
      properties: {
        texts: { type: "array", items: { type: "string" }, description: "Texts to embed" },
        provider: { type: "string", enum: ["openai", "voyage", "cohere"] },
        model: { type: "string" },
      },
      required: ["texts"],
    },
  },
  {
    name: "similarity",
    description: "Calculate cosine similarity between two embeddings.",
    inputSchema: {
      type: "object",
      properties: {
        embedding1: { type: "array", items: { type: "number" } },
        embedding2: { type: "array", items: { type: "number" } },
      },
      required: ["embedding1", "embedding2"],
    },
  },
  {
    name: "similarity_text",
    description: "Calculate similarity between two texts.",
    inputSchema: {
      type: "object",
      properties: {
        text1: { type: "string" },
        text2: { type: "string" },
        provider: { type: "string", enum: ["openai", "voyage", "cohere"] },
        model: { type: "string" },
      },
      required: ["text1", "text2"],
    },
  },
  {
    name: "find_most_similar",
    description: "Find most similar items from a list.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query text" },
        candidates: { type: "array", items: { type: "string" }, description: "Candidate texts" },
        topK: { type: "number", description: "Number of results" },
        provider: { type: "string" },
        model: { type: "string" },
      },
      required: ["query", "candidates"],
    },
  },
  {
    name: "cluster_texts",
    description: "Cluster texts by similarity.",
    inputSchema: {
      type: "object",
      properties: {
        texts: { type: "array", items: { type: "string" } },
        numClusters: { type: "number", description: "Number of clusters" },
        provider: { type: "string" },
        model: { type: "string" },
      },
      required: ["texts", "numClusters"],
    },
  },
  {
    name: "list_models",
    description: "List available embedding models.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function embedOpenAI(texts: string[], model: string): Promise<number[][]> {
  const res = await openai.embeddings.create({ model, input: texts });
  return res.data.map(d => d.embedding);
}

async function embedVoyage(texts: string[], model: string): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.voyageKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || "voyage-2", input: texts }),
  });
  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

async function embedCohere(texts: string[], model: string): Promise<number[][]> {
  const res = await fetch("https://api.cohere.ai/v1/embed", {
    method: "POST",
    headers: { "Authorization": `Bearer ${config.cohereKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || "embed-english-v3.0", texts, input_type: "search_document" }),
  });
  const data = await res.json();
  return data.embeddings;
}

async function getEmbeddings(texts: string[], provider?: string, model?: string): Promise<number[][]> {
  const p = provider || config.defaultProvider;
  const m = model || config.defaultModel;

  switch (p) {
    case "openai": return embedOpenAI(texts, m);
    case "voyage": return embedVoyage(texts, m);
    case "cohere": return embedCohere(texts, m);
    default: throw new Error(`Unknown provider: ${p}`);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vectors must have same dimension");
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedText(params: { text: string; provider?: string; model?: string }): Promise<any> {
  const embeddings = await getEmbeddings([params.text], params.provider, params.model);
  return { embedding: embeddings[0], dimensions: embeddings[0].length, provider: params.provider || config.defaultProvider, model: params.model || config.defaultModel };
}

async function embedBatch(params: { texts: string[]; provider?: string; model?: string }): Promise<any> {
  const embeddings = await getEmbeddings(params.texts, params.provider, params.model);
  return { embeddings, count: embeddings.length, dimensions: embeddings[0]?.length || 0 };
}

function similarity(params: { embedding1: number[]; embedding2: number[] }): any {
  const sim = cosineSimilarity(params.embedding1, params.embedding2);
  return { similarity: sim, distance: 1 - sim };
}

async function similarityText(params: { text1: string; text2: string; provider?: string; model?: string }): Promise<any> {
  const embeddings = await getEmbeddings([params.text1, params.text2], params.provider, params.model);
  const sim = cosineSimilarity(embeddings[0], embeddings[1]);
  return { text1: params.text1.slice(0, 50), text2: params.text2.slice(0, 50), similarity: sim };
}

async function findMostSimilar(params: { query: string; candidates: string[]; topK?: number; provider?: string; model?: string }): Promise<any> {
  const allTexts = [params.query, ...params.candidates];
  const embeddings = await getEmbeddings(allTexts, params.provider, params.model);
  const queryEmb = embeddings[0];
  const candidateEmbs = embeddings.slice(1);

  const scores = params.candidates.map((text, i) => ({
    text,
    index: i,
    similarity: cosineSimilarity(queryEmb, candidateEmbs[i]),
  }));

  scores.sort((a, b) => b.similarity - a.similarity);
  return { results: scores.slice(0, params.topK || 5) };
}

async function clusterTexts(params: { texts: string[]; numClusters: number; provider?: string; model?: string }): Promise<any> {
  const embeddings = await getEmbeddings(params.texts, params.provider, params.model);

  // Simple k-means clustering
  const k = params.numClusters;
  const dims = embeddings[0].length;

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const used = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * embeddings.length);
    if (!used.has(idx)) {
      used.add(idx);
      centroids.push([...embeddings[idx]]);
    }
  }

  // Run k-means for 10 iterations
  let assignments: number[] = [];
  for (let iter = 0; iter < 10; iter++) {
    // Assign points to nearest centroid
    assignments = embeddings.map(emb => {
      let minDist = Infinity, minIdx = 0;
      centroids.forEach((c, i) => {
        const dist = 1 - cosineSimilarity(emb, c);
        if (dist < minDist) { minDist = dist; minIdx = i; }
      });
      return minIdx;
    });

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = embeddings.filter((_, i) => assignments[i] === c);
      if (members.length > 0) {
        for (let d = 0; d < dims; d++) {
          centroids[c][d] = members.reduce((sum, m) => sum + m[d], 0) / members.length;
        }
      }
    }
  }

  // Group texts by cluster
  const clusters: { id: number; texts: string[] }[] = [];
  for (let c = 0; c < k; c++) {
    clusters.push({
      id: c,
      texts: params.texts.filter((_, i) => assignments[i] === c),
    });
  }

  return { clusters, numClusters: k };
}

function listModels(): any {
  return {
    openai: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
    voyage: ["voyage-2", "voyage-large-2", "voyage-code-2"],
    cohere: ["embed-english-v3.0", "embed-multilingual-v3.0", "embed-english-light-v3.0"],
  };
}

const server = new Server({ name: "embeddings-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "embed_text": result = await embedText(args as any); break;
      case "embed_batch": result = await embedBatch(args as any); break;
      case "similarity": result = similarity(args as any); break;
      case "similarity_text": result = await similarityText(args as any); break;
      case "find_most_similar": result = await findMostSimilar(args as any); break;
      case "cluster_texts": result = await clusterTexts(args as any); break;
      case "list_models": result = listModels(); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Embeddings MCP Server running on stdio");
}

main().catch(console.error);
