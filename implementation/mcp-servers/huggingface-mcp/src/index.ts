/**
 * HuggingFace MCP Server - Access to HF Hub models and datasets for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiKey: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "",
  hubUrl: "https://huggingface.co",
  inferenceUrl: "https://api-inference.huggingface.co",
};

async function hfRequest(url: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.arrayBuffer();
}

const TOOLS: Tool[] = [
  // Inference API
  {
    name: "text_generation",
    description: "Generate text using a language model.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model ID (e.g., meta-llama/Llama-2-7b-chat-hf)" },
        inputs: { type: "string" },
        parameters: {
          type: "object",
          properties: {
            maxNewTokens: { type: "number" },
            temperature: { type: "number" },
            topP: { type: "number" },
            topK: { type: "number" },
            repetitionPenalty: { type: "number" },
            doSample: { type: "boolean" },
            returnFullText: { type: "boolean" },
          },
        },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "text_classification",
    description: "Classify text into categories.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "string" },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "token_classification",
    description: "Classify tokens (NER, POS tagging).",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "string" },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "question_answering",
    description: "Answer questions based on context.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: {
          type: "object",
          properties: {
            question: { type: "string" },
            context: { type: "string" },
          },
          required: ["question", "context"],
        },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "fill_mask",
    description: "Fill in masked tokens.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "string", description: "Text with [MASK] token" },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "summarization",
    description: "Summarize text.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "string" },
        parameters: {
          type: "object",
          properties: {
            maxLength: { type: "number" },
            minLength: { type: "number" },
          },
        },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "translation",
    description: "Translate text between languages.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "string" },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "text_to_image",
    description: "Generate images from text.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "e.g., stabilityai/stable-diffusion-xl-base-1.0" },
        inputs: { type: "string", description: "Text prompt" },
        parameters: {
          type: "object",
          properties: {
            negativePrompt: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
            numInferenceSteps: { type: "number" },
            guidanceScale: { type: "number" },
          },
        },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "image_to_text",
    description: "Generate text description of an image.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        imageBase64: { type: "string" },
      },
      required: ["model", "imageBase64"],
    },
  },
  {
    name: "embeddings",
    description: "Generate text embeddings.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "string" },
      },
      required: ["model", "inputs"],
    },
  },
  {
    name: "zero_shot_classification",
    description: "Classify text without training examples.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: { type: "string" },
        parameters: {
          type: "object",
          properties: {
            candidateLabels: { type: "array", items: { type: "string" } },
            multiLabel: { type: "boolean" },
          },
          required: ["candidateLabels"],
        },
      },
      required: ["model", "inputs", "parameters"],
    },
  },
  {
    name: "sentence_similarity",
    description: "Compute similarity between sentences.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        inputs: {
          type: "object",
          properties: {
            sourceSentence: { type: "string" },
            sentences: { type: "array", items: { type: "string" } },
          },
          required: ["sourceSentence", "sentences"],
        },
      },
      required: ["model", "inputs"],
    },
  },
  // Hub API
  {
    name: "list_models",
    description: "List models on HuggingFace Hub.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        author: { type: "string" },
        filter: { type: "string", description: "e.g., text-generation, image-classification" },
        sort: { type: "string", enum: ["downloads", "likes", "lastModified"] },
        direction: { type: "number", enum: [-1, 1] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_model_info",
    description: "Get detailed model information.",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string" },
      },
      required: ["modelId"],
    },
  },
  {
    name: "list_datasets",
    description: "List datasets on HuggingFace Hub.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        author: { type: "string" },
        filter: { type: "string" },
        sort: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_dataset_info",
    description: "Get detailed dataset information.",
    inputSchema: {
      type: "object",
      properties: {
        datasetId: { type: "string" },
      },
      required: ["datasetId"],
    },
  },
  {
    name: "list_spaces",
    description: "List Spaces on HuggingFace Hub.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        author: { type: "string" },
        sort: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  // User/Organization
  {
    name: "whoami",
    description: "Get current user information.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function textGeneration(params: { model: string; inputs: string; parameters?: any }): Promise<any> {
  const res = await hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({
      inputs: params.inputs,
      parameters: {
        max_new_tokens: params.parameters?.maxNewTokens,
        temperature: params.parameters?.temperature,
        top_p: params.parameters?.topP,
        top_k: params.parameters?.topK,
        repetition_penalty: params.parameters?.repetitionPenalty,
        do_sample: params.parameters?.doSample,
        return_full_text: params.parameters?.returnFullText,
      },
    }),
  });
  return Array.isArray(res) ? res : [res];
}

async function textClassification(params: { model: string; inputs: string }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({ inputs: params.inputs }),
  });
}

async function tokenClassification(params: { model: string; inputs: string }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({ inputs: params.inputs }),
  });
}

async function questionAnswering(params: { model: string; inputs: { question: string; context: string } }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({ inputs: params.inputs }),
  });
}

async function fillMask(params: { model: string; inputs: string }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({ inputs: params.inputs }),
  });
}

async function summarization(params: { model: string; inputs: string; parameters?: any }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({
      inputs: params.inputs,
      parameters: {
        max_length: params.parameters?.maxLength,
        min_length: params.parameters?.minLength,
      },
    }),
  });
}

async function translation(params: { model: string; inputs: string }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({ inputs: params.inputs }),
  });
}

async function textToImage(params: { model: string; inputs: string; parameters?: any }): Promise<any> {
  const res = await hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({
      inputs: params.inputs,
      parameters: {
        negative_prompt: params.parameters?.negativePrompt,
        width: params.parameters?.width,
        height: params.parameters?.height,
        num_inference_steps: params.parameters?.numInferenceSteps,
        guidance_scale: params.parameters?.guidanceScale,
      },
    }),
  });
  if (res instanceof ArrayBuffer) {
    return { imageBase64: Buffer.from(res).toString("base64") };
  }
  return res;
}

async function imageToText(params: { model: string; imageBase64: string }): Promise<any> {
  const imageBuffer = Buffer.from(params.imageBase64, "base64");
  const res = await fetch(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });
  return res.json();
}

async function embeddings(params: { model: string; inputs: string }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({ inputs: params.inputs }),
  });
}

async function zeroShotClassification(params: { model: string; inputs: string; parameters: { candidateLabels: string[]; multiLabel?: boolean } }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({
      inputs: params.inputs,
      parameters: {
        candidate_labels: params.parameters.candidateLabels,
        multi_label: params.parameters.multiLabel,
      },
    }),
  });
}

async function sentenceSimilarity(params: { model: string; inputs: { sourceSentence: string; sentences: string[] } }): Promise<any> {
  return hfRequest(`${config.inferenceUrl}/models/${params.model}`, {
    method: "POST",
    body: JSON.stringify({
      inputs: {
        source_sentence: params.inputs.sourceSentence,
        sentences: params.inputs.sentences,
      },
    }),
  });
}

async function listModels(params: { search?: string; author?: string; filter?: string; sort?: string; direction?: number; limit?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.author) query.set("author", params.author);
  if (params.filter) query.set("filter", params.filter);
  if (params.sort) query.set("sort", params.sort);
  if (params.direction) query.set("direction", params.direction.toString());
  if (params.limit) query.set("limit", params.limit.toString());

  const res = await hfRequest(`${config.hubUrl}/api/models?${query.toString()}`);
  return { models: res };
}

async function getModelInfo(params: { modelId: string }): Promise<any> {
  return hfRequest(`${config.hubUrl}/api/models/${params.modelId}`);
}

async function listDatasets(params: { search?: string; author?: string; filter?: string; sort?: string; limit?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.author) query.set("author", params.author);
  if (params.filter) query.set("filter", params.filter);
  if (params.sort) query.set("sort", params.sort);
  if (params.limit) query.set("limit", params.limit.toString());

  const res = await hfRequest(`${config.hubUrl}/api/datasets?${query.toString()}`);
  return { datasets: res };
}

async function getDatasetInfo(params: { datasetId: string }): Promise<any> {
  return hfRequest(`${config.hubUrl}/api/datasets/${params.datasetId}`);
}

async function listSpaces(params: { search?: string; author?: string; sort?: string; limit?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.author) query.set("author", params.author);
  if (params.sort) query.set("sort", params.sort);
  if (params.limit) query.set("limit", params.limit.toString());

  const res = await hfRequest(`${config.hubUrl}/api/spaces?${query.toString()}`);
  return { spaces: res };
}

async function whoami(): Promise<any> {
  return hfRequest(`${config.hubUrl}/api/whoami-v2`);
}

const server = new Server({ name: "huggingface-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "text_generation": result = await textGeneration(args as any); break;
      case "text_classification": result = await textClassification(args as any); break;
      case "token_classification": result = await tokenClassification(args as any); break;
      case "question_answering": result = await questionAnswering(args as any); break;
      case "fill_mask": result = await fillMask(args as any); break;
      case "summarization": result = await summarization(args as any); break;
      case "translation": result = await translation(args as any); break;
      case "text_to_image": result = await textToImage(args as any); break;
      case "image_to_text": result = await imageToText(args as any); break;
      case "embeddings": result = await embeddings(args as any); break;
      case "zero_shot_classification": result = await zeroShotClassification(args as any); break;
      case "sentence_similarity": result = await sentenceSimilarity(args as any); break;
      case "list_models": result = await listModels(args as any); break;
      case "get_model_info": result = await getModelInfo(args as any); break;
      case "list_datasets": result = await listDatasets(args as any); break;
      case "get_dataset_info": result = await getDatasetInfo(args as any); break;
      case "list_spaces": result = await listSpaces(args as any); break;
      case "whoami": result = await whoami(); break;
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
  console.error("HuggingFace MCP Server running on stdio");
}

main().catch(console.error);
