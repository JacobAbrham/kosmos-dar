/**
 * Anthropic MCP Server - Direct Claude API access for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import Anthropic from "@anthropic-ai/sdk";

const config = {
  apiKey: process.env.ANTHROPIC_API_KEY || "",
  defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || "claude-3-opus-20240229",
};

const anthropic = new Anthropic({ apiKey: config.apiKey });

const TOOLS: Tool[] = [
  // Messages
  { name: "create_message", description: "Create a message completion.", inputSchema: { type: "object", properties: { messages: { type: "array", items: { type: "object", properties: { role: { type: "string" }, content: { type: "string" } } } }, model: { type: "string" }, maxTokens: { type: "number" }, system: { type: "string" }, temperature: { type: "number" }, topP: { type: "number" }, topK: { type: "number" }, stopSequences: { type: "array", items: { type: "string" } }, metadata: { type: "object" } }, required: ["messages", "maxTokens"] } },
  { name: "create_message_with_tools", description: "Create a message with tool use.", inputSchema: { type: "object", properties: { messages: { type: "array" }, model: { type: "string" }, maxTokens: { type: "number" }, system: { type: "string" }, tools: { type: "array" }, toolChoice: { type: "object" }, temperature: { type: "number" } }, required: ["messages", "maxTokens", "tools"] } },
  { name: "create_message_stream", description: "Create a streaming message completion.", inputSchema: { type: "object", properties: { messages: { type: "array" }, model: { type: "string" }, maxTokens: { type: "number" }, system: { type: "string" }, temperature: { type: "number" }, stopSequences: { type: "array", items: { type: "string" } } }, required: ["messages", "maxTokens"] } },
  // Vision
  { name: "analyze_image", description: "Analyze an image with Claude's vision.", inputSchema: { type: "object", properties: { imageBase64: { type: "string" }, mediaType: { type: "string", enum: ["image/jpeg", "image/png", "image/gif", "image/webp"] }, prompt: { type: "string" }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["imageBase64", "mediaType", "prompt"] } },
  { name: "analyze_images", description: "Analyze multiple images.", inputSchema: { type: "object", properties: { images: { type: "array", items: { type: "object", properties: { base64: { type: "string" }, mediaType: { type: "string" } } } }, prompt: { type: "string" }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["images", "prompt"] } },
  // Document Analysis
  { name: "analyze_document", description: "Analyze a document with Claude.", inputSchema: { type: "object", properties: { documentBase64: { type: "string" }, mediaType: { type: "string" }, prompt: { type: "string" }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["documentBase64", "mediaType", "prompt"] } },
  // Structured Output
  { name: "extract_structured", description: "Extract structured data from text.", inputSchema: { type: "object", properties: { text: { type: "string" }, schema: { type: "object" }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["text", "schema"] } },
  // Summarization
  { name: "summarize", description: "Summarize text.", inputSchema: { type: "object", properties: { text: { type: "string" }, maxLength: { type: "number" }, style: { type: "string", enum: ["brief", "detailed", "bullet_points"] }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["text"] } },
  // Translation
  { name: "translate", description: "Translate text.", inputSchema: { type: "object", properties: { text: { type: "string" }, targetLanguage: { type: "string" }, sourceLanguage: { type: "string" }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["text", "targetLanguage"] } },
  // Code
  { name: "generate_code", description: "Generate code.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, language: { type: "string" }, context: { type: "string" }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["prompt", "language"] } },
  { name: "explain_code", description: "Explain code.", inputSchema: { type: "object", properties: { code: { type: "string" }, language: { type: "string" }, detailLevel: { type: "string", enum: ["brief", "detailed", "line_by_line"] }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["code"] } },
  { name: "review_code", description: "Review code for issues.", inputSchema: { type: "object", properties: { code: { type: "string" }, language: { type: "string" }, focusAreas: { type: "array", items: { type: "string" } }, model: { type: "string" }, maxTokens: { type: "number" } }, required: ["code"] } },
  // Counting
  { name: "count_tokens", description: "Count tokens in text.", inputSchema: { type: "object", properties: { text: { type: "string" }, model: { type: "string" } }, required: ["text"] } },
  // Models info
  { name: "list_models", description: "List available Claude models.", inputSchema: { type: "object", properties: {} } },
];

async function createMessage(params: { messages: Array<{ role: string; content: string }>; model?: string; maxTokens: number; system?: string; temperature?: number; topP?: number; topK?: number; stopSequences?: string[]; metadata?: any }): Promise<any> {
  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens,
    messages: params.messages as any,
    system: params.system,
    temperature: params.temperature,
    top_p: params.topP,
    top_k: params.topK,
    stop_sequences: params.stopSequences,
    metadata: params.metadata,
  });
  return {
    id: res.id,
    content: res.content.map(c => c.type === "text" ? c.text : c).join(""),
    stopReason: res.stop_reason,
    usage: res.usage,
  };
}

async function createMessageWithTools(params: { messages: any[]; model?: string; maxTokens: number; system?: string; tools: any[]; toolChoice?: any; temperature?: number }): Promise<any> {
  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens,
    messages: params.messages,
    system: params.system,
    tools: params.tools,
    tool_choice: params.toolChoice,
    temperature: params.temperature,
  });
  return {
    id: res.id,
    content: res.content,
    stopReason: res.stop_reason,
    usage: res.usage,
  };
}

async function createMessageStream(params: { messages: any[]; model?: string; maxTokens: number; system?: string; temperature?: number; stopSequences?: string[] }): Promise<any> {
  const stream = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens,
    messages: params.messages,
    system: params.system,
    temperature: params.temperature,
    stop_sequences: params.stopSequences,
    stream: true,
  });

  let fullText = "";
  let usage: any = null;

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullText += event.delta.text;
    }
    if (event.type === "message_delta") {
      usage = event.usage;
    }
  }

  return { content: fullText, usage };
}

async function analyzeImage(params: { imageBase64: string; mediaType: string; prompt: string; model?: string; maxTokens?: number }): Promise<any> {
  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: params.mediaType as any, data: params.imageBase64 } },
        { type: "text", text: params.prompt },
      ],
    }],
  });
  return { content: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function analyzeImages(params: { images: Array<{ base64: string; mediaType: string }>; prompt: string; model?: string; maxTokens?: number }): Promise<any> {
  const content: any[] = params.images.map(img => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.base64 },
  }));
  content.push({ type: "text", text: params.prompt });

  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    messages: [{ role: "user", content }],
  });
  return { content: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function analyzeDocument(params: { documentBase64: string; mediaType: string; prompt: string; model?: string; maxTokens?: number }): Promise<any> {
  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: params.mediaType as any, data: params.documentBase64 } },
        { type: "text", text: params.prompt },
      ],
    }],
  });
  return { content: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function extractStructured(params: { text: string; schema: any; model?: string; maxTokens?: number }): Promise<any> {
  const prompt = `Extract structured data from the following text according to this JSON schema:
${JSON.stringify(params.schema, null, 2)}

Text:
${params.text}

Return ONLY valid JSON matching the schema, with no additional text.`;

  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = res.content.map(c => c.type === "text" ? c.text : c).join("");
  try {
    return { data: JSON.parse(content), usage: res.usage };
  } catch {
    return { rawContent: content, usage: res.usage };
  }
}

async function summarize(params: { text: string; maxLength?: number; style?: string; model?: string; maxTokens?: number }): Promise<any> {
  const styleGuide = {
    brief: "Provide a very concise 1-2 sentence summary.",
    detailed: "Provide a comprehensive summary covering all key points.",
    bullet_points: "Provide a summary in bullet point format.",
  };

  const prompt = `${styleGuide[params.style as keyof typeof styleGuide] || styleGuide.detailed}
${params.maxLength ? `Keep the summary under ${params.maxLength} words.` : ""}

Text to summarize:
${params.text}`;

  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 2048,
    messages: [{ role: "user", content: prompt }],
  });
  return { summary: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function translate(params: { text: string; targetLanguage: string; sourceLanguage?: string; model?: string; maxTokens?: number }): Promise<any> {
  const prompt = `Translate the following text${params.sourceLanguage ? ` from ${params.sourceLanguage}` : ""} to ${params.targetLanguage}. Preserve formatting and tone.

Text:
${params.text}`;

  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    messages: [{ role: "user", content: prompt }],
  });
  return { translation: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function generateCode(params: { prompt: string; language: string; context?: string; model?: string; maxTokens?: number }): Promise<any> {
  const systemPrompt = `You are an expert ${params.language} programmer. Generate clean, well-documented code.`;
  const userPrompt = `${params.context ? `Context:\n${params.context}\n\n` : ""}Generate ${params.language} code for:\n${params.prompt}`;

  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return { code: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function explainCode(params: { code: string; language?: string; detailLevel?: string; model?: string; maxTokens?: number }): Promise<any> {
  const detail = params.detailLevel || "detailed";
  const prompt = `Explain the following ${params.language || ""} code ${detail === "line_by_line" ? "line by line" : detail === "brief" ? "briefly" : "in detail"}:

\`\`\`${params.language || ""}
${params.code}
\`\`\``;

  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    messages: [{ role: "user", content: prompt }],
  });
  return { explanation: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function reviewCode(params: { code: string; language?: string; focusAreas?: string[]; model?: string; maxTokens?: number }): Promise<any> {
  const focus = params.focusAreas?.length ? `Focus on: ${params.focusAreas.join(", ")}` : "";
  const prompt = `Review the following ${params.language || ""} code for issues, improvements, and best practices. ${focus}

\`\`\`${params.language || ""}
${params.code}
\`\`\``;

  const res = await anthropic.messages.create({
    model: params.model || config.defaultModel,
    max_tokens: params.maxTokens || 4096,
    messages: [{ role: "user", content: prompt }],
  });
  return { review: res.content.map(c => c.type === "text" ? c.text : c).join(""), usage: res.usage };
}

async function countTokens(params: { text: string; model?: string }): Promise<any> {
  const res = await anthropic.messages.countTokens({
    model: params.model || config.defaultModel,
    messages: [{ role: "user", content: params.text }],
  });
  return { inputTokens: res.input_tokens };
}

function listModels(): any {
  return {
    models: [
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Most capable model for complex tasks" },
      { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", description: "Balanced performance and speed" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fastest and most compact" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Latest Sonnet with improved capabilities" },
    ],
  };
}

const server = new Server({ name: "anthropic-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "create_message": result = await createMessage(args as any); break;
      case "create_message_with_tools": result = await createMessageWithTools(args as any); break;
      case "create_message_stream": result = await createMessageStream(args as any); break;
      case "analyze_image": result = await analyzeImage(args as any); break;
      case "analyze_images": result = await analyzeImages(args as any); break;
      case "analyze_document": result = await analyzeDocument(args as any); break;
      case "extract_structured": result = await extractStructured(args as any); break;
      case "summarize": result = await summarize(args as any); break;
      case "translate": result = await translate(args as any); break;
      case "generate_code": result = await generateCode(args as any); break;
      case "explain_code": result = await explainCode(args as any); break;
      case "review_code": result = await reviewCode(args as any); break;
      case "count_tokens": result = await countTokens(args as any); break;
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
  console.error("Anthropic MCP Server running on stdio");
}

main().catch(console.error);
