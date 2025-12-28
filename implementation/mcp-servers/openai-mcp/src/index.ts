/**
 * OpenAI MCP Server - Direct OpenAI API access for KOSMOS agents
 *
 * Provides comprehensive access to OpenAI's API including:
 * - Chat completions (GPT-4, GPT-3.5-turbo)
 * - Legacy text completions
 * - Embeddings (text-embedding-3-small/large)
 * - Image generation and editing (DALL-E)
 * - Audio transcription and translation (Whisper)
 * - Text-to-speech
 * - Content moderation
 * - File management
 * - Fine-tuning
 * - Assistants API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";

// Configuration from environment variables
const config = {
  apiKey: process.env.OPENAI_API_KEY || "",
  organization: process.env.OPENAI_ORG_ID || "",
  defaultModel: process.env.OPENAI_DEFAULT_MODEL || "gpt-4-turbo-preview",
  defaultEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
};

// Validate API key
if (!config.apiKey) {
  console.error("Warning: OPENAI_API_KEY environment variable is not set");
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.apiKey,
  organization: config.organization || undefined,
});

// Tool definitions
const TOOLS: Tool[] = [
  // Chat Completions
  {
    name: "chat_completion",
    description: "Create a chat completion using GPT-4 or GPT-3.5-turbo models. Supports multi-turn conversations with system, user, and assistant messages.",
    inputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          description: "Array of messages in the conversation",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["system", "user", "assistant"], description: "The role of the message author" },
              content: { type: "string", description: "The content of the message" },
            },
            required: ["role", "content"],
          },
        },
        model: { type: "string", description: "Model to use (e.g., gpt-4-turbo-preview, gpt-3.5-turbo)" },
        temperature: { type: "number", description: "Sampling temperature (0-2)", minimum: 0, maximum: 2 },
        maxTokens: { type: "number", description: "Maximum tokens to generate" },
        topP: { type: "number", description: "Nucleus sampling parameter", minimum: 0, maximum: 1 },
        frequencyPenalty: { type: "number", description: "Frequency penalty (-2 to 2)", minimum: -2, maximum: 2 },
        presencePenalty: { type: "number", description: "Presence penalty (-2 to 2)", minimum: -2, maximum: 2 },
        stop: { type: "array", items: { type: "string" }, description: "Stop sequences" },
        responseFormat: { type: "object", description: "Response format (e.g., {type: 'json_object'})" },
      },
      required: ["messages"],
    },
  },

  // Legacy Text Completions
  {
    name: "completion",
    description: "Create a text completion using legacy completion models. Note: This endpoint is deprecated for most models; use chat_completion instead.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The prompt to complete" },
        model: { type: "string", description: "Model to use (e.g., gpt-3.5-turbo-instruct)" },
        maxTokens: { type: "number", description: "Maximum tokens to generate" },
        temperature: { type: "number", description: "Sampling temperature (0-2)" },
        topP: { type: "number", description: "Nucleus sampling parameter" },
        frequencyPenalty: { type: "number", description: "Frequency penalty" },
        presencePenalty: { type: "number", description: "Presence penalty" },
        stop: { type: "array", items: { type: "string" }, description: "Stop sequences" },
        suffix: { type: "string", description: "Suffix to append after completion" },
        echo: { type: "boolean", description: "Echo back the prompt in addition to the completion" },
        bestOf: { type: "number", description: "Generate multiple completions and return the best" },
      },
      required: ["prompt"],
    },
  },

  // Embeddings
  {
    name: "create_embedding",
    description: "Create embeddings for text using OpenAI's embedding models. Useful for semantic search, clustering, and similarity comparisons.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Text to create embedding for" },
        model: { type: "string", description: "Embedding model (text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002)" },
        dimensions: { type: "number", description: "Number of dimensions for the embedding (only for text-embedding-3-* models)" },
      },
      required: ["input"],
    },
  },

  // Models
  {
    name: "list_models",
    description: "List all available OpenAI models accessible with your API key.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_model",
    description: "Get details about a specific model including capabilities and ownership.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model ID to retrieve" },
      },
      required: ["model"],
    },
  },

  // Image Generation (DALL-E)
  {
    name: "create_image",
    description: "Generate an image using DALL-E 2 or DALL-E 3 from a text prompt.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Text description of the desired image" },
        model: { type: "string", enum: ["dall-e-2", "dall-e-3"], description: "DALL-E model to use" },
        size: { type: "string", enum: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"], description: "Image size" },
        quality: { type: "string", enum: ["standard", "hd"], description: "Image quality (DALL-E 3 only)" },
        n: { type: "number", description: "Number of images to generate (1-10 for DALL-E 2, 1 for DALL-E 3)" },
        style: { type: "string", enum: ["vivid", "natural"], description: "Image style (DALL-E 3 only)" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "edit_image",
    description: "Edit an existing image using DALL-E. Requires a base64-encoded image and optionally a mask.",
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Base64-encoded PNG image to edit" },
        prompt: { type: "string", description: "Description of the desired edit" },
        mask: { type: "string", description: "Base64-encoded PNG mask (transparent areas will be edited)" },
        size: { type: "string", enum: ["256x256", "512x512", "1024x1024"], description: "Output image size" },
        n: { type: "number", description: "Number of images to generate" },
      },
      required: ["image", "prompt"],
    },
  },
  {
    name: "create_image_variation",
    description: "Create variations of an existing image using DALL-E.",
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Base64-encoded PNG image" },
        n: { type: "number", description: "Number of variations to generate" },
        size: { type: "string", enum: ["256x256", "512x512", "1024x1024"], description: "Output image size" },
      },
      required: ["image"],
    },
  },

  // Audio (Whisper & TTS)
  {
    name: "transcribe_audio",
    description: "Transcribe audio to text using Whisper. Supports multiple languages and formats.",
    inputSchema: {
      type: "object",
      properties: {
        audioBase64: { type: "string", description: "Base64-encoded audio file" },
        model: { type: "string", description: "Model to use (whisper-1)" },
        language: { type: "string", description: "Language code (e.g., 'en', 'es', 'fr')" },
        prompt: { type: "string", description: "Optional prompt to guide transcription style" },
        responseFormat: { type: "string", enum: ["json", "text", "srt", "verbose_json", "vtt"], description: "Output format" },
        temperature: { type: "number", description: "Sampling temperature" },
      },
      required: ["audioBase64"],
    },
  },
  {
    name: "translate_audio",
    description: "Translate audio to English using Whisper. Input can be in any supported language.",
    inputSchema: {
      type: "object",
      properties: {
        audioBase64: { type: "string", description: "Base64-encoded audio file" },
        model: { type: "string", description: "Model to use (whisper-1)" },
        prompt: { type: "string", description: "Optional prompt to guide translation" },
        responseFormat: { type: "string", enum: ["json", "text", "srt", "verbose_json", "vtt"], description: "Output format" },
      },
      required: ["audioBase64"],
    },
  },
  {
    name: "create_speech",
    description: "Generate speech audio from text using OpenAI's TTS models.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Text to convert to speech" },
        model: { type: "string", enum: ["tts-1", "tts-1-hd"], description: "TTS model to use" },
        voice: { type: "string", enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"], description: "Voice to use" },
        responseFormat: { type: "string", enum: ["mp3", "opus", "aac", "flac", "wav", "pcm"], description: "Audio format" },
        speed: { type: "number", description: "Speech speed (0.25 to 4.0)", minimum: 0.25, maximum: 4.0 },
      },
      required: ["input"],
    },
  },

  // Files
  {
    name: "list_files",
    description: "List files uploaded to OpenAI for fine-tuning or assistants.",
    inputSchema: {
      type: "object",
      properties: {
        purpose: { type: "string", enum: ["fine-tune", "assistants"], description: "Filter by file purpose" },
      },
    },
  },
  {
    name: "upload_file",
    description: "Upload a file to OpenAI for fine-tuning or use with assistants.",
    inputSchema: {
      type: "object",
      properties: {
        fileContent: { type: "string", description: "Base64-encoded file content" },
        filename: { type: "string", description: "Name for the file" },
        purpose: { type: "string", enum: ["fine-tune", "assistants"], description: "Purpose of the file" },
      },
      required: ["fileContent", "filename", "purpose"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from OpenAI.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID of the file to delete" },
      },
      required: ["fileId"],
    },
  },

  // Fine-tuning
  {
    name: "create_fine_tune",
    description: "Create a fine-tuning job to customize a model on your training data.",
    inputSchema: {
      type: "object",
      properties: {
        trainingFile: { type: "string", description: "File ID of the training data" },
        model: { type: "string", description: "Base model to fine-tune (e.g., gpt-3.5-turbo)" },
        validationFile: { type: "string", description: "File ID of validation data (optional)" },
        hyperparameters: {
          type: "object",
          description: "Training hyperparameters",
          properties: {
            n_epochs: { type: "number" },
            batch_size: { type: "number" },
            learning_rate_multiplier: { type: "number" },
          },
        },
        suffix: { type: "string", description: "Suffix to append to the fine-tuned model name" },
      },
      required: ["trainingFile", "model"],
    },
  },
  {
    name: "list_fine_tunes",
    description: "List all fine-tuning jobs.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_fine_tune",
    description: "Get details about a specific fine-tuning job.",
    inputSchema: {
      type: "object",
      properties: {
        fineTuneId: { type: "string", description: "ID of the fine-tuning job" },
      },
      required: ["fineTuneId"],
    },
  },
  {
    name: "cancel_fine_tune",
    description: "Cancel a running fine-tuning job.",
    inputSchema: {
      type: "object",
      properties: {
        fineTuneId: { type: "string", description: "ID of the fine-tuning job to cancel" },
      },
      required: ["fineTuneId"],
    },
  },

  // Content Moderation
  {
    name: "moderate_content",
    description: "Check content for policy violations using OpenAI's moderation API.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Content to check for policy violations" },
        model: { type: "string", description: "Moderation model to use" },
      },
      required: ["input"],
    },
  },

  // Assistants
  {
    name: "list_assistants",
    description: "List all assistants created with the Assistants API.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of assistants to return" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order by creation time" },
        after: { type: "string", description: "Cursor for pagination (ID to start after)" },
        before: { type: "string", description: "Cursor for pagination (ID to start before)" },
      },
    },
  },
  {
    name: "create_assistant",
    description: "Create an assistant with custom instructions and tools.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model to use for the assistant" },
        name: { type: "string", description: "Name of the assistant" },
        description: { type: "string", description: "Description of the assistant" },
        instructions: { type: "string", description: "System instructions for the assistant" },
        tools: {
          type: "array",
          description: "Tools available to the assistant",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["code_interpreter", "retrieval", "function"] },
            },
          },
        },
        fileIds: { type: "array", items: { type: "string" }, description: "File IDs to attach to the assistant" },
        metadata: { type: "object", description: "Custom metadata for the assistant" },
      },
      required: ["model"],
    },
  },
];

// Implementation functions

async function chatCompletion(params: {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  responseFormat?: any;
}): Promise<any> {
  const res = await openai.chat.completions.create({
    model: params.model || config.defaultModel,
    messages: params.messages as any,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: params.topP,
    frequency_penalty: params.frequencyPenalty,
    presence_penalty: params.presencePenalty,
    stop: params.stop,
    response_format: params.responseFormat,
  });
  return {
    id: res.id,
    model: res.model,
    content: res.choices[0]?.message?.content,
    role: res.choices[0]?.message?.role,
    finishReason: res.choices[0]?.finish_reason,
    usage: res.usage,
  };
}

async function completion(params: {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  suffix?: string;
  echo?: boolean;
  bestOf?: number;
}): Promise<any> {
  const res = await openai.completions.create({
    model: params.model || "gpt-3.5-turbo-instruct",
    prompt: params.prompt,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    top_p: params.topP,
    frequency_penalty: params.frequencyPenalty,
    presence_penalty: params.presencePenalty,
    stop: params.stop,
    suffix: params.suffix,
    echo: params.echo,
    best_of: params.bestOf,
  });
  return {
    id: res.id,
    model: res.model,
    text: res.choices[0]?.text,
    finishReason: res.choices[0]?.finish_reason,
    usage: res.usage,
  };
}

async function createEmbedding(params: {
  input: string;
  model?: string;
  dimensions?: number;
}): Promise<any> {
  const res = await openai.embeddings.create({
    model: params.model || config.defaultEmbeddingModel,
    input: params.input,
    dimensions: params.dimensions,
  });
  return {
    embedding: res.data[0]?.embedding,
    dimensions: res.data[0]?.embedding?.length,
    model: res.model,
    usage: res.usage,
  };
}

async function listModels(): Promise<any> {
  const res = await openai.models.list();
  return {
    models: res.data.map((m) => ({
      id: m.id,
      ownedBy: m.owned_by,
      created: m.created,
    })),
  };
}

async function getModel(params: { model: string }): Promise<any> {
  const res = await openai.models.retrieve(params.model);
  return {
    id: res.id,
    ownedBy: res.owned_by,
    created: res.created,
    object: res.object,
  };
}

async function createImage(params: {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  n?: number;
  style?: string;
}): Promise<any> {
  const res = await openai.images.generate({
    model: params.model || "dall-e-3",
    prompt: params.prompt,
    size: (params.size || "1024x1024") as any,
    quality: (params.quality || "standard") as any,
    n: params.n || 1,
    style: (params.style || "vivid") as any,
  });
  return {
    images: res.data.map((img) => ({
      url: img.url,
      revisedPrompt: img.revised_prompt,
    })),
  };
}

async function editImage(params: {
  image: string;
  prompt: string;
  mask?: string;
  size?: string;
  n?: number;
}): Promise<any> {
  const imageBuffer = Buffer.from(params.image, "base64");
  const res = await openai.images.edit({
    image: new File([imageBuffer], "image.png", { type: "image/png" }),
    prompt: params.prompt,
    mask: params.mask
      ? new File([Buffer.from(params.mask, "base64")], "mask.png", { type: "image/png" })
      : undefined,
    size: (params.size || "1024x1024") as any,
    n: params.n || 1,
  });
  return {
    images: res.data.map((img) => ({ url: img.url })),
  };
}

async function createImageVariation(params: {
  image: string;
  n?: number;
  size?: string;
}): Promise<any> {
  const imageBuffer = Buffer.from(params.image, "base64");
  const res = await openai.images.createVariation({
    image: new File([imageBuffer], "image.png", { type: "image/png" }),
    n: params.n || 1,
    size: (params.size || "1024x1024") as any,
  });
  return {
    images: res.data.map((img) => ({ url: img.url })),
  };
}

async function transcribeAudio(params: {
  audioBase64: string;
  model?: string;
  language?: string;
  prompt?: string;
  responseFormat?: string;
  temperature?: number;
}): Promise<any> {
  const audioBuffer = Buffer.from(params.audioBase64, "base64");
  const res = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" }),
    model: params.model || "whisper-1",
    language: params.language,
    prompt: params.prompt,
    response_format: params.responseFormat as any,
    temperature: params.temperature,
  });
  return {
    text: typeof res === "string" ? res : res.text,
  };
}

async function translateAudio(params: {
  audioBase64: string;
  model?: string;
  prompt?: string;
  responseFormat?: string;
}): Promise<any> {
  const audioBuffer = Buffer.from(params.audioBase64, "base64");
  const res = await openai.audio.translations.create({
    file: new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" }),
    model: params.model || "whisper-1",
    prompt: params.prompt,
    response_format: params.responseFormat as any,
  });
  return {
    text: typeof res === "string" ? res : res.text,
  };
}

async function createSpeech(params: {
  input: string;
  model?: string;
  voice?: string;
  responseFormat?: string;
  speed?: number;
}): Promise<any> {
  const res = await openai.audio.speech.create({
    model: params.model || "tts-1",
    voice: (params.voice || "alloy") as any,
    input: params.input,
    response_format: (params.responseFormat || "mp3") as any,
    speed: params.speed,
  });
  const buffer = await res.arrayBuffer();
  return {
    audioBase64: Buffer.from(buffer).toString("base64"),
    format: params.responseFormat || "mp3",
  };
}

async function listFiles(params: { purpose?: string }): Promise<any> {
  const res = await openai.files.list({ purpose: params.purpose as any });
  return {
    files: res.data.map((f) => ({
      id: f.id,
      filename: f.filename,
      purpose: f.purpose,
      bytes: f.bytes,
      createdAt: f.created_at,
      status: f.status,
    })),
  };
}

async function uploadFile(params: {
  fileContent: string;
  filename: string;
  purpose: string;
}): Promise<any> {
  const buffer = Buffer.from(params.fileContent, "base64");
  const res = await openai.files.create({
    file: new File([buffer], params.filename),
    purpose: params.purpose as any,
  });
  return {
    id: res.id,
    filename: res.filename,
    purpose: res.purpose,
    bytes: res.bytes,
    status: res.status,
  };
}

async function deleteFile(params: { fileId: string }): Promise<any> {
  const res = await openai.files.del(params.fileId);
  return {
    id: res.id,
    deleted: res.deleted,
  };
}

async function createFineTune(params: {
  trainingFile: string;
  model: string;
  validationFile?: string;
  hyperparameters?: any;
  suffix?: string;
}): Promise<any> {
  const res = await openai.fineTuning.jobs.create({
    training_file: params.trainingFile,
    model: params.model,
    validation_file: params.validationFile,
    hyperparameters: params.hyperparameters,
    suffix: params.suffix,
  });
  return {
    id: res.id,
    model: res.model,
    status: res.status,
    createdAt: res.created_at,
    trainingFile: res.training_file,
    validationFile: res.validation_file,
  };
}

async function listFineTunes(): Promise<any> {
  const res = await openai.fineTuning.jobs.list();
  return {
    jobs: res.data.map((j) => ({
      id: j.id,
      model: j.model,
      status: j.status,
      fineTunedModel: j.fine_tuned_model,
      createdAt: j.created_at,
      finishedAt: j.finished_at,
    })),
  };
}

async function getFineTune(params: { fineTuneId: string }): Promise<any> {
  const res = await openai.fineTuning.jobs.retrieve(params.fineTuneId);
  return {
    id: res.id,
    model: res.model,
    status: res.status,
    fineTunedModel: res.fine_tuned_model,
    createdAt: res.created_at,
    finishedAt: res.finished_at,
    trainingFile: res.training_file,
    validationFile: res.validation_file,
    trainedTokens: res.trained_tokens,
    error: res.error,
  };
}

async function cancelFineTune(params: { fineTuneId: string }): Promise<any> {
  const res = await openai.fineTuning.jobs.cancel(params.fineTuneId);
  return {
    id: res.id,
    status: res.status,
  };
}

async function moderateContent(params: { input: string; model?: string }): Promise<any> {
  const res = await openai.moderations.create({
    input: params.input,
    model: params.model,
  });
  return {
    id: res.id,
    model: res.model,
    results: res.results.map((r) => ({
      flagged: r.flagged,
      categories: r.categories,
      categoryScores: r.category_scores,
    })),
  };
}

async function listAssistants(params: {
  limit?: number;
  order?: string;
  after?: string;
  before?: string;
}): Promise<any> {
  const res = await openai.beta.assistants.list({
    limit: params.limit,
    order: params.order as any,
    after: params.after,
    before: params.before,
  });
  return {
    assistants: res.data.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      model: a.model,
      instructions: a.instructions,
      tools: a.tools,
      createdAt: a.created_at,
    })),
    hasMore: res.has_more,
  };
}

async function createAssistant(params: {
  model: string;
  name?: string;
  description?: string;
  instructions?: string;
  tools?: any[];
  fileIds?: string[];
  metadata?: any;
}): Promise<any> {
  const res = await openai.beta.assistants.create({
    model: params.model,
    name: params.name,
    description: params.description,
    instructions: params.instructions,
    tools: params.tools,
    file_ids: params.fileIds,
    metadata: params.metadata,
  });
  return {
    id: res.id,
    name: res.name,
    description: res.description,
    model: res.model,
    instructions: res.instructions,
    tools: res.tools,
    fileIds: res.file_ids,
    createdAt: res.created_at,
  };
}

// Create MCP server
const server = new Server(
  {
    name: "openai-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Chat and Completions
      case "chat_completion":
        result = await chatCompletion(args as any);
        break;
      case "completion":
        result = await completion(args as any);
        break;

      // Embeddings
      case "create_embedding":
        result = await createEmbedding(args as any);
        break;

      // Models
      case "list_models":
        result = await listModels();
        break;
      case "get_model":
        result = await getModel(args as any);
        break;

      // Images
      case "create_image":
        result = await createImage(args as any);
        break;
      case "edit_image":
        result = await editImage(args as any);
        break;
      case "create_image_variation":
        result = await createImageVariation(args as any);
        break;

      // Audio
      case "transcribe_audio":
        result = await transcribeAudio(args as any);
        break;
      case "translate_audio":
        result = await translateAudio(args as any);
        break;
      case "create_speech":
        result = await createSpeech(args as any);
        break;

      // Files
      case "list_files":
        result = await listFiles(args as any);
        break;
      case "upload_file":
        result = await uploadFile(args as any);
        break;
      case "delete_file":
        result = await deleteFile(args as any);
        break;

      // Fine-tuning
      case "create_fine_tune":
        result = await createFineTune(args as any);
        break;
      case "list_fine_tunes":
        result = await listFineTunes();
        break;
      case "get_fine_tune":
        result = await getFineTune(args as any);
        break;
      case "cancel_fine_tune":
        result = await cancelFineTune(args as any);
        break;

      // Moderation
      case "moderate_content":
        result = await moderateContent(args as any);
        break;

      // Assistants
      case "list_assistants":
        result = await listAssistants(args as any);
        break;
      case "create_assistant":
        result = await createAssistant(args as any);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    const errorMessage = error.message || "Unknown error occurred";
    const errorDetails = {
      error: errorMessage,
      code: error.code,
      type: error.type,
      status: error.status,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(errorDetails, null, 2) }],
      isError: true,
    };
  }
});

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenAI MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start OpenAI MCP Server:", error);
  process.exit(1);
});
