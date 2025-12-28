/**
 * Haystack MCP Server - NLP pipeline and RAG operations for KOSMOS agents
 * Implements Haystack-style document processing, search, and question answering
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

// Configuration
const config = {
  apiUrl: process.env.HAYSTACK_API_URL || "",
  apiKey: process.env.HAYSTACK_API_KEY || "",
  embeddingModel: process.env.HAYSTACK_EMBEDDING_MODEL || "text-embedding-3-small",
  llmModel: process.env.HAYSTACK_LLM_MODEL || "gpt-4",
  openaiKey: process.env.OPENAI_API_KEY || "",
};

// Types
interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  score?: number;
}

interface Pipeline {
  id: string;
  name: string;
  components: PipelineComponent[];
  createdAt: string;
  updatedAt: string;
  stats: PipelineStats;
}

interface PipelineComponent {
  name: string;
  type: string;
  config: Record<string, any>;
}

interface PipelineStats {
  runCount: number;
  avgLatencyMs: number;
  lastRunAt?: string;
  totalDocumentsProcessed: number;
  successRate: number;
}

interface SearchIndex {
  id: string;
  name: string;
  documentCount: number;
  embeddingDimension: number;
  createdAt: string;
}

// In-memory stores (for local implementation)
const documentStore: Map<string, Document> = new Map();
const pipelineStore: Map<string, Pipeline> = new Map();
const indexStore: Map<string, SearchIndex> = new Map();

// Helper functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function apiRequest(endpoint: string, method: string = "GET", body?: any): Promise<any> {
  if (!config.apiUrl) {
    throw new Error("HAYSTACK_API_URL not configured - using local implementation");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${config.apiUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Haystack API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Simple embedding generation (using OpenAI or mock)
async function generateEmbedding(text: string): Promise<number[]> {
  if (config.openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.embeddingModel,
          input: text,
        }),
      });
      const data = await response.json();
      return data.data[0].embedding;
    } catch {
      // Fall back to mock embeddings
    }
  }

  // Mock embedding generation (for testing without API)
  const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array(384).fill(0).map((_, i) => Math.sin(hash + i) * 0.5);
}

// Simple LLM call (using OpenAI or mock)
async function callLLM(prompt: string, systemPrompt?: string): Promise<string> {
  if (config.openaiKey) {
    try {
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.llmModel,
          messages,
          temperature: 0.7,
        }),
      });
      const data = await response.json();
      return data.choices[0].message.content;
    } catch {
      // Fall back to mock response
    }
  }

  return `[Mock LLM Response for: ${prompt.substring(0, 100)}...]`;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Tool definitions
const TOOLS: Tool[] = [
  // Pipeline Management
  {
    name: "create_pipeline",
    description: "Create a new processing pipeline with specified components.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Pipeline name" },
        components: {
          type: "array",
          description: "Pipeline components (retriever, reader, generator, etc.)",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Component name" },
              type: { type: "string", enum: ["retriever", "reader", "generator", "ranker", "embedder", "preprocessor", "classifier"], description: "Component type" },
              config: { type: "object", description: "Component configuration" },
            },
            required: ["name", "type"],
          },
        },
        description: { type: "string", description: "Pipeline description" },
      },
      required: ["name", "components"],
    },
  },
  {
    name: "run_pipeline",
    description: "Execute a pipeline with given input.",
    inputSchema: {
      type: "object",
      properties: {
        pipelineId: { type: "string", description: "Pipeline ID to run" },
        input: { type: "object", description: "Input data for the pipeline" },
        query: { type: "string", description: "Query string for retrieval pipelines" },
        documents: { type: "array", items: { type: "string" }, description: "Document IDs to process" },
        params: { type: "object", description: "Additional pipeline parameters" },
      },
      required: ["pipelineId"],
    },
  },
  {
    name: "list_pipelines",
    description: "List all available pipelines.",
    inputSchema: {
      type: "object",
      properties: {
        includeStats: { type: "boolean", description: "Include pipeline statistics" },
      },
    },
  },

  // Document Operations
  {
    name: "add_documents",
    description: "Add documents to the document store.",
    inputSchema: {
      type: "object",
      properties: {
        documents: {
          type: "array",
          description: "Documents to add",
          items: {
            type: "object",
            properties: {
              content: { type: "string", description: "Document content" },
              metadata: { type: "object", description: "Document metadata" },
              id: { type: "string", description: "Optional document ID" },
            },
            required: ["content"],
          },
        },
        indexId: { type: "string", description: "Index to add documents to" },
        generateEmbeddings: { type: "boolean", description: "Generate embeddings for documents" },
      },
      required: ["documents"],
    },
  },
  {
    name: "search_documents",
    description: "Search documents using semantic or keyword search.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        topK: { type: "number", description: "Number of results to return" },
        indexId: { type: "string", description: "Index to search in" },
        filters: { type: "object", description: "Metadata filters" },
        searchType: { type: "string", enum: ["semantic", "keyword", "hybrid"], description: "Search type" },
      },
      required: ["query"],
    },
  },
  {
    name: "delete_documents",
    description: "Delete documents from the store.",
    inputSchema: {
      type: "object",
      properties: {
        documentIds: { type: "array", items: { type: "string" }, description: "Document IDs to delete" },
        filters: { type: "object", description: "Delete documents matching filters" },
        indexId: { type: "string", description: "Index to delete from" },
      },
    },
  },
  {
    name: "get_document",
    description: "Get a specific document by ID.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        includeEmbedding: { type: "boolean", description: "Include embedding vector" },
      },
      required: ["documentId"],
    },
  },
  {
    name: "list_documents",
    description: "List documents with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        indexId: { type: "string", description: "Index to list from" },
        filters: { type: "object", description: "Metadata filters" },
        limit: { type: "number", description: "Maximum documents to return" },
        offset: { type: "number", description: "Offset for pagination" },
      },
    },
  },

  // Index Operations
  {
    name: "create_index",
    description: "Create a new search index.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Index name" },
        embeddingDimension: { type: "number", description: "Embedding vector dimension" },
        similarityMetric: { type: "string", enum: ["cosine", "dot_product", "euclidean"], description: "Similarity metric" },
        settings: { type: "object", description: "Additional index settings" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_embeddings",
    description: "Update or regenerate embeddings for documents.",
    inputSchema: {
      type: "object",
      properties: {
        documentIds: { type: "array", items: { type: "string" }, description: "Specific documents to update" },
        indexId: { type: "string", description: "Index containing documents" },
        model: { type: "string", description: "Embedding model to use" },
        batchSize: { type: "number", description: "Batch size for processing" },
      },
    },
  },

  // RAG Operations
  {
    name: "query_rag",
    description: "Run a RAG (Retrieval-Augmented Generation) query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query to answer" },
        topK: { type: "number", description: "Number of documents to retrieve" },
        indexId: { type: "string", description: "Index to search" },
        generationParams: { type: "object", description: "Generation parameters (temperature, max_tokens, etc.)" },
        includeSourceDocuments: { type: "boolean", description: "Include source documents in response" },
        systemPrompt: { type: "string", description: "Custom system prompt for generation" },
      },
      required: ["query"],
    },
  },
  {
    name: "extract_answers",
    description: "Extract answers from documents for a given question.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Question to answer" },
        documents: { type: "array", items: { type: "string" }, description: "Document IDs to search" },
        context: { type: "string", description: "Context text to search in" },
        topK: { type: "number", description: "Number of answers to extract" },
        minScore: { type: "number", description: "Minimum confidence score" },
      },
      required: ["question"],
    },
  },

  // NLP Operations
  {
    name: "summarize_documents",
    description: "Summarize one or more documents.",
    inputSchema: {
      type: "object",
      properties: {
        documentIds: { type: "array", items: { type: "string" }, description: "Documents to summarize" },
        text: { type: "string", description: "Text to summarize (if not using document IDs)" },
        summaryLength: { type: "string", enum: ["short", "medium", "long"], description: "Desired summary length" },
        style: { type: "string", enum: ["bullet_points", "paragraph", "executive"], description: "Summary style" },
      },
    },
  },
  {
    name: "classify_document",
    description: "Classify a document into categories.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID to classify" },
        text: { type: "string", description: "Text to classify (if not using document ID)" },
        categories: { type: "array", items: { type: "string" }, description: "Possible categories" },
        multiLabel: { type: "boolean", description: "Allow multiple categories" },
      },
      required: ["categories"],
    },
  },
  {
    name: "extract_entities",
    description: "Extract named entities from text or documents.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID to process" },
        text: { type: "string", description: "Text to process (if not using document ID)" },
        entityTypes: { type: "array", items: { type: "string" }, description: "Entity types to extract (PERSON, ORG, LOCATION, DATE, etc.)" },
      },
    },
  },
  {
    name: "translate_document",
    description: "Translate document content to another language.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID to translate" },
        text: { type: "string", description: "Text to translate (if not using document ID)" },
        sourceLanguage: { type: "string", description: "Source language code (auto-detect if not specified)" },
        targetLanguage: { type: "string", description: "Target language code" },
      },
      required: ["targetLanguage"],
    },
  },
  {
    name: "generate_questions",
    description: "Generate questions from text or documents.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID to generate questions from" },
        text: { type: "string", description: "Text to generate questions from" },
        numQuestions: { type: "number", description: "Number of questions to generate" },
        questionType: { type: "string", enum: ["factual", "conceptual", "analytical", "mixed"], description: "Type of questions" },
      },
    },
  },

  // Evaluation
  {
    name: "evaluate_retrieval",
    description: "Evaluate retrieval quality with test queries.",
    inputSchema: {
      type: "object",
      properties: {
        queries: {
          type: "array",
          description: "Test queries with expected results",
          items: {
            type: "object",
            properties: {
              query: { type: "string" },
              expectedDocIds: { type: "array", items: { type: "string" } },
            },
            required: ["query", "expectedDocIds"],
          },
        },
        indexId: { type: "string", description: "Index to evaluate" },
        topK: { type: "number", description: "Number of results to retrieve per query" },
        metrics: { type: "array", items: { type: "string" }, description: "Metrics to compute (precision, recall, mrr, map)" },
      },
      required: ["queries"],
    },
  },
  {
    name: "get_pipeline_stats",
    description: "Get statistics for a pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        pipelineId: { type: "string", description: "Pipeline ID" },
        timeRange: { type: "string", enum: ["1h", "24h", "7d", "30d"], description: "Time range for stats" },
      },
      required: ["pipelineId"],
    },
  },
];

// Implementation functions

// Pipeline Management
async function createPipeline(params: {
  name: string;
  components: PipelineComponent[];
  description?: string;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/pipelines", "POST", params);
  }

  const pipeline: Pipeline = {
    id: generateId(),
    name: params.name,
    components: params.components,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: {
      runCount: 0,
      avgLatencyMs: 0,
      totalDocumentsProcessed: 0,
      successRate: 100,
    },
  };

  pipelineStore.set(pipeline.id, pipeline);
  return {
    id: pipeline.id,
    name: pipeline.name,
    components: pipeline.components.length,
    created: true,
  };
}

async function runPipeline(params: {
  pipelineId: string;
  input?: any;
  query?: string;
  documents?: string[];
  params?: any;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest(`/pipelines/${params.pipelineId}/run`, "POST", params);
  }

  const pipeline = pipelineStore.get(params.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${params.pipelineId}`);
  }

  const startTime = Date.now();
  const results: any = { pipelineId: params.pipelineId, outputs: [] };

  // Process each component
  for (const component of pipeline.components) {
    switch (component.type) {
      case "retriever":
        if (params.query) {
          const searchResults = await searchDocuments({ query: params.query, topK: 5 });
          results.outputs.push({ component: component.name, type: "retrieval", results: searchResults });
        }
        break;
      case "embedder":
        if (params.documents) {
          for (const docId of params.documents) {
            const doc = documentStore.get(docId);
            if (doc && doc.content) {
              doc.embedding = await generateEmbedding(doc.content);
              documentStore.set(docId, doc);
            }
          }
          results.outputs.push({ component: component.name, type: "embedding", processed: params.documents.length });
        }
        break;
      case "generator":
        if (params.query) {
          const answer = await callLLM(params.query);
          results.outputs.push({ component: component.name, type: "generation", output: answer });
        }
        break;
      default:
        results.outputs.push({ component: component.name, type: component.type, status: "processed" });
    }
  }

  // Update pipeline stats
  const latency = Date.now() - startTime;
  pipeline.stats.runCount++;
  pipeline.stats.avgLatencyMs = (pipeline.stats.avgLatencyMs * (pipeline.stats.runCount - 1) + latency) / pipeline.stats.runCount;
  pipeline.stats.lastRunAt = new Date().toISOString();
  pipeline.updatedAt = new Date().toISOString();
  pipelineStore.set(pipeline.id, pipeline);

  results.latencyMs = latency;
  return results;
}

async function listPipelines(params: { includeStats?: boolean }): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/pipelines");
  }

  const pipelines = Array.from(pipelineStore.values()).map((p) => ({
    id: p.id,
    name: p.name,
    componentCount: p.components.length,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(params.includeStats ? { stats: p.stats } : {}),
  }));

  return { pipelines, count: pipelines.length };
}

// Document Operations
async function addDocuments(params: {
  documents: Array<{ content: string; metadata?: Record<string, any>; id?: string }>;
  indexId?: string;
  generateEmbeddings?: boolean;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/documents", "POST", params);
  }

  const added: string[] = [];
  for (const doc of params.documents) {
    const id = doc.id || generateId();
    const document: Document = {
      id,
      content: doc.content,
      metadata: doc.metadata || {},
    };

    if (params.generateEmbeddings !== false) {
      document.embedding = await generateEmbedding(doc.content);
    }

    documentStore.set(id, document);
    added.push(id);
  }

  // Update index if specified
  if (params.indexId) {
    const index = indexStore.get(params.indexId);
    if (index) {
      index.documentCount += added.length;
      indexStore.set(params.indexId, index);
    }
  }

  return { added: added.length, documentIds: added };
}

async function searchDocuments(params: {
  query: string;
  topK?: number;
  indexId?: string;
  filters?: Record<string, any>;
  searchType?: string;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/search", "POST", params);
  }

  const queryEmbedding = await generateEmbedding(params.query);
  const topK = params.topK || 10;
  const searchType = params.searchType || "semantic";

  const results: Document[] = [];
  for (const doc of documentStore.values()) {
    // Apply filters
    if (params.filters) {
      let match = true;
      for (const [key, value] of Object.entries(params.filters)) {
        if (doc.metadata[key] !== value) {
          match = false;
          break;
        }
      }
      if (!match) continue;
    }

    let score = 0;
    if (searchType === "semantic" || searchType === "hybrid") {
      if (doc.embedding) {
        score = cosineSimilarity(queryEmbedding, doc.embedding);
      }
    }
    if (searchType === "keyword" || searchType === "hybrid") {
      const queryTerms = params.query.toLowerCase().split(/\s+/);
      const contentLower = doc.content.toLowerCase();
      const keywordScore = queryTerms.filter((term) => contentLower.includes(term)).length / queryTerms.length;
      score = searchType === "hybrid" ? (score + keywordScore) / 2 : keywordScore;
    }

    results.push({ ...doc, score });
  }

  results.sort((a, b) => (b.score || 0) - (a.score || 0));
  return {
    documents: results.slice(0, topK).map((d) => ({
      id: d.id,
      content: d.content.substring(0, 500) + (d.content.length > 500 ? "..." : ""),
      metadata: d.metadata,
      score: d.score,
    })),
    count: Math.min(results.length, topK),
  };
}

async function deleteDocuments(params: {
  documentIds?: string[];
  filters?: Record<string, any>;
  indexId?: string;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/documents", "DELETE", params);
  }

  let deleted = 0;

  if (params.documentIds) {
    for (const id of params.documentIds) {
      if (documentStore.delete(id)) {
        deleted++;
      }
    }
  }

  if (params.filters) {
    for (const [id, doc] of documentStore.entries()) {
      let match = true;
      for (const [key, value] of Object.entries(params.filters)) {
        if (doc.metadata[key] !== value) {
          match = false;
          break;
        }
      }
      if (match) {
        documentStore.delete(id);
        deleted++;
      }
    }
  }

  return { deleted };
}

async function getDocument(params: { documentId: string; includeEmbedding?: boolean }): Promise<any> {
  if (config.apiUrl) {
    return apiRequest(`/documents/${params.documentId}`);
  }

  const doc = documentStore.get(params.documentId);
  if (!doc) {
    throw new Error(`Document not found: ${params.documentId}`);
  }

  const result: any = {
    id: doc.id,
    content: doc.content,
    metadata: doc.metadata,
  };

  if (params.includeEmbedding && doc.embedding) {
    result.embedding = doc.embedding;
    result.embeddingDimension = doc.embedding.length;
  }

  return result;
}

async function listDocuments(params: {
  indexId?: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/documents");
  }

  let documents = Array.from(documentStore.values());

  // Apply filters
  if (params.filters) {
    documents = documents.filter((doc) => {
      for (const [key, value] of Object.entries(params.filters!)) {
        if (doc.metadata[key] !== value) return false;
      }
      return true;
    });
  }

  const offset = params.offset || 0;
  const limit = params.limit || 100;

  return {
    documents: documents.slice(offset, offset + limit).map((d) => ({
      id: d.id,
      contentPreview: d.content.substring(0, 200) + (d.content.length > 200 ? "..." : ""),
      metadata: d.metadata,
      hasEmbedding: !!d.embedding,
    })),
    total: documents.length,
    offset,
    limit,
  };
}

// Index Operations
async function createIndex(params: {
  name: string;
  embeddingDimension?: number;
  similarityMetric?: string;
  settings?: Record<string, any>;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/indices", "POST", params);
  }

  const index: SearchIndex = {
    id: generateId(),
    name: params.name,
    documentCount: 0,
    embeddingDimension: params.embeddingDimension || 384,
    createdAt: new Date().toISOString(),
  };

  indexStore.set(index.id, index);
  return {
    id: index.id,
    name: index.name,
    embeddingDimension: index.embeddingDimension,
    created: true,
  };
}

async function updateEmbeddings(params: {
  documentIds?: string[];
  indexId?: string;
  model?: string;
  batchSize?: number;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/embeddings/update", "POST", params);
  }

  const docIds = params.documentIds || Array.from(documentStore.keys());
  let updated = 0;

  for (const id of docIds) {
    const doc = documentStore.get(id);
    if (doc) {
      doc.embedding = await generateEmbedding(doc.content);
      documentStore.set(id, doc);
      updated++;
    }
  }

  return { updated, model: params.model || config.embeddingModel };
}

// RAG Operations
async function queryRag(params: {
  query: string;
  topK?: number;
  indexId?: string;
  generationParams?: Record<string, any>;
  includeSourceDocuments?: boolean;
  systemPrompt?: string;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/rag/query", "POST", params);
  }

  // Retrieve relevant documents
  const searchResults = await searchDocuments({
    query: params.query,
    topK: params.topK || 5,
    indexId: params.indexId,
  });

  // Build context from retrieved documents
  const context = searchResults.documents
    .map((d: any, i: number) => `[Document ${i + 1}]: ${d.content}`)
    .join("\n\n");

  // Generate answer
  const systemPrompt = params.systemPrompt ||
    "You are a helpful assistant. Answer questions based on the provided context. If the answer is not in the context, say so.";

  const prompt = `Context:\n${context}\n\nQuestion: ${params.query}\n\nAnswer:`;
  const answer = await callLLM(prompt, systemPrompt);

  const result: any = {
    query: params.query,
    answer,
    documentsUsed: searchResults.count,
  };

  if (params.includeSourceDocuments) {
    result.sourceDocuments = searchResults.documents;
  }

  return result;
}

async function extractAnswers(params: {
  question: string;
  documents?: string[];
  context?: string;
  topK?: number;
  minScore?: number;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/answers/extract", "POST", params);
  }

  let context = params.context || "";

  if (params.documents) {
    const docs = params.documents
      .map((id) => documentStore.get(id))
      .filter((d) => d)
      .map((d) => d!.content);
    context = docs.join("\n\n");
  }

  if (!context) {
    // Search for relevant documents
    const searchResults = await searchDocuments({ query: params.question, topK: 5 });
    context = searchResults.documents.map((d: any) => d.content).join("\n\n");
  }

  const prompt = `Based on the following context, extract the answer to the question. Return the answer with confidence score.

Context: ${context}

Question: ${params.question}

Provide the answer in JSON format: {"answer": "...", "confidence": 0.X, "span": "exact text from context"}`;

  const response = await callLLM(prompt);

  try {
    const parsed = JSON.parse(response);
    return {
      question: params.question,
      answers: [parsed],
    };
  } catch {
    return {
      question: params.question,
      answers: [{ answer: response, confidence: 0.5 }],
    };
  }
}

// NLP Operations
async function summarizeDocuments(params: {
  documentIds?: string[];
  text?: string;
  summaryLength?: string;
  style?: string;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/summarize", "POST", params);
  }

  let text = params.text || "";

  if (params.documentIds) {
    const docs = params.documentIds
      .map((id) => documentStore.get(id))
      .filter((d) => d)
      .map((d) => d!.content);
    text = docs.join("\n\n---\n\n");
  }

  if (!text) {
    throw new Error("No text or document IDs provided for summarization");
  }

  const lengthGuide = {
    short: "2-3 sentences",
    medium: "1-2 paragraphs",
    long: "comprehensive overview",
  };

  const styleGuide = {
    bullet_points: "Use bullet points",
    paragraph: "Write in paragraph form",
    executive: "Write an executive summary",
  };

  const length = lengthGuide[params.summaryLength as keyof typeof lengthGuide] || lengthGuide.medium;
  const style = styleGuide[params.style as keyof typeof styleGuide] || styleGuide.paragraph;

  const prompt = `Summarize the following text. Length: ${length}. Style: ${style}.

Text: ${text}

Summary:`;

  const summary = await callLLM(prompt);
  return { summary, originalLength: text.length, style: params.style || "paragraph" };
}

async function classifyDocument(params: {
  documentId?: string;
  text?: string;
  categories: string[];
  multiLabel?: boolean;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/classify", "POST", params);
  }

  let text = params.text || "";

  if (params.documentId) {
    const doc = documentStore.get(params.documentId);
    if (doc) {
      text = doc.content;
    }
  }

  if (!text) {
    throw new Error("No text or document ID provided for classification");
  }

  const prompt = `Classify the following text into ${params.multiLabel ? "one or more of" : "exactly one of"} these categories: ${params.categories.join(", ")}

Text: ${text}

Return the result as JSON: ${params.multiLabel ? '{"categories": [...], "confidences": {...}}' : '{"category": "...", "confidence": 0.X}'}`;

  const response = await callLLM(prompt);

  try {
    return JSON.parse(response);
  } catch {
    return { category: params.categories[0], confidence: 0.5, rawResponse: response };
  }
}

async function extractEntities(params: {
  documentId?: string;
  text?: string;
  entityTypes?: string[];
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/entities/extract", "POST", params);
  }

  let text = params.text || "";

  if (params.documentId) {
    const doc = documentStore.get(params.documentId);
    if (doc) {
      text = doc.content;
    }
  }

  if (!text) {
    throw new Error("No text or document ID provided for entity extraction");
  }

  const entityTypes = params.entityTypes || ["PERSON", "ORG", "LOCATION", "DATE", "MONEY", "PRODUCT"];

  const prompt = `Extract named entities from the following text. Entity types to look for: ${entityTypes.join(", ")}

Text: ${text}

Return as JSON: {"entities": [{"text": "...", "type": "...", "start": 0, "end": 0}]}`;

  const response = await callLLM(prompt);

  try {
    return JSON.parse(response);
  } catch {
    return { entities: [], rawResponse: response };
  }
}

async function translateDocument(params: {
  documentId?: string;
  text?: string;
  sourceLanguage?: string;
  targetLanguage: string;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/translate", "POST", params);
  }

  let text = params.text || "";

  if (params.documentId) {
    const doc = documentStore.get(params.documentId);
    if (doc) {
      text = doc.content;
    }
  }

  if (!text) {
    throw new Error("No text or document ID provided for translation");
  }

  const sourceLang = params.sourceLanguage || "auto-detect";
  const prompt = `Translate the following text ${sourceLang !== "auto-detect" ? `from ${sourceLang}` : ""} to ${params.targetLanguage}.

Original text: ${text}

Translation:`;

  const translation = await callLLM(prompt);
  return {
    original: text,
    translation,
    sourceLanguage: params.sourceLanguage || "auto-detected",
    targetLanguage: params.targetLanguage,
  };
}

async function generateQuestions(params: {
  documentId?: string;
  text?: string;
  numQuestions?: number;
  questionType?: string;
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/questions/generate", "POST", params);
  }

  let text = params.text || "";

  if (params.documentId) {
    const doc = documentStore.get(params.documentId);
    if (doc) {
      text = doc.content;
    }
  }

  if (!text) {
    throw new Error("No text or document ID provided for question generation");
  }

  const numQuestions = params.numQuestions || 5;
  const questionType = params.questionType || "mixed";

  const prompt = `Generate ${numQuestions} ${questionType} questions based on the following text. Include the expected answer for each question.

Text: ${text}

Return as JSON: {"questions": [{"question": "...", "answer": "...", "type": "${questionType}"}]}`;

  const response = await callLLM(prompt);

  try {
    return JSON.parse(response);
  } catch {
    return { questions: [], rawResponse: response };
  }
}

// Evaluation
async function evaluateRetrieval(params: {
  queries: Array<{ query: string; expectedDocIds: string[] }>;
  indexId?: string;
  topK?: number;
  metrics?: string[];
}): Promise<any> {
  if (config.apiUrl) {
    return apiRequest("/evaluate/retrieval", "POST", params);
  }

  const topK = params.topK || 10;
  const metrics = params.metrics || ["precision", "recall", "mrr", "map"];

  const results: any[] = [];
  let totalPrecision = 0;
  let totalRecall = 0;
  let totalMrr = 0;

  for (const testCase of params.queries) {
    const searchResults = await searchDocuments({
      query: testCase.query,
      topK,
      indexId: params.indexId,
    });

    const retrievedIds = searchResults.documents.map((d: any) => d.id);
    const expectedSet = new Set(testCase.expectedDocIds);
    const retrievedSet = new Set(retrievedIds);

    const relevant = retrievedIds.filter((id: string) => expectedSet.has(id));
    const precision = relevant.length / retrievedIds.length || 0;
    const recall = relevant.length / testCase.expectedDocIds.length || 0;

    // MRR calculation
    let rr = 0;
    for (let i = 0; i < retrievedIds.length; i++) {
      if (expectedSet.has(retrievedIds[i])) {
        rr = 1 / (i + 1);
        break;
      }
    }

    totalPrecision += precision;
    totalRecall += recall;
    totalMrr += rr;

    results.push({
      query: testCase.query,
      precision,
      recall,
      mrr: rr,
      retrievedCount: retrievedIds.length,
      relevantCount: relevant.length,
    });
  }

  const n = params.queries.length;
  return {
    results,
    aggregatedMetrics: {
      avgPrecision: totalPrecision / n,
      avgRecall: totalRecall / n,
      mrr: totalMrr / n,
    },
    totalQueries: n,
  };
}

async function getPipelineStats(params: { pipelineId: string; timeRange?: string }): Promise<any> {
  if (config.apiUrl) {
    return apiRequest(`/pipelines/${params.pipelineId}/stats?timeRange=${params.timeRange || "24h"}`);
  }

  const pipeline = pipelineStore.get(params.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${params.pipelineId}`);
  }

  return {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    stats: pipeline.stats,
    components: pipeline.components.map((c) => ({ name: c.name, type: c.type })),
    timeRange: params.timeRange || "24h",
  };
}

// Server setup
const server = new Server(
  { name: "haystack-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Pipeline Management
      case "create_pipeline": result = await createPipeline(args as any); break;
      case "run_pipeline": result = await runPipeline(args as any); break;
      case "list_pipelines": result = await listPipelines(args as any); break;

      // Document Operations
      case "add_documents": result = await addDocuments(args as any); break;
      case "search_documents": result = await searchDocuments(args as any); break;
      case "delete_documents": result = await deleteDocuments(args as any); break;
      case "get_document": result = await getDocument(args as any); break;
      case "list_documents": result = await listDocuments(args as any); break;

      // Index Operations
      case "create_index": result = await createIndex(args as any); break;
      case "update_embeddings": result = await updateEmbeddings(args as any); break;

      // RAG Operations
      case "query_rag": result = await queryRag(args as any); break;
      case "extract_answers": result = await extractAnswers(args as any); break;

      // NLP Operations
      case "summarize_documents": result = await summarizeDocuments(args as any); break;
      case "classify_document": result = await classifyDocument(args as any); break;
      case "extract_entities": result = await extractEntities(args as any); break;
      case "translate_document": result = await translateDocument(args as any); break;
      case "generate_questions": result = await generateQuestions(args as any); break;

      // Evaluation
      case "evaluate_retrieval": result = await evaluateRetrieval(args as any); break;
      case "get_pipeline_stats": result = await getPipelineStats(args as any); break;

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
  console.error("Haystack MCP Server running on stdio");
}

main().catch(console.error);
