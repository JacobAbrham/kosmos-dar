/**
 * MinIO MCP Server - S3-compatible object storage for KOSMOS agents
 *
 * Provides comprehensive MinIO/S3 storage operations including:
 * - Bucket management (create, delete, list, policies)
 * - Object operations (get, put, delete, copy)
 * - Presigned URLs for secure access
 * - Object tagging and metadata
 * - Versioning configuration
 * - Multipart upload management
 *
 * Authentication: Uses MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY env vars.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as Minio from "minio";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
};

const minio = new Minio.Client(config);

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Bucket operations
  {
    name: "list_buckets",
    description: "List all buckets in the MinIO server.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_bucket",
    description: "Create a new bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        region: { type: "string", description: "Region (optional)" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "delete_bucket",
    description: "Delete an empty bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name to delete" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "get_bucket_policy",
    description: "Get the access policy of a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "set_bucket_policy",
    description: "Set the access policy of a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        policy: {
          type: "string",
          description: "Policy JSON string (S3 bucket policy format)",
        },
      },
      required: ["bucket", "policy"],
    },
  },
  // Object operations
  {
    name: "list_objects",
    description: "List objects in a bucket with optional prefix filter.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        prefix: { type: "string", description: "Filter by prefix" },
        recursive: {
          type: "boolean",
          description: "List recursively (default: false)",
        },
        maxKeys: {
          type: "number",
          description: "Maximum number of objects to return",
        },
      },
      required: ["bucket"],
    },
  },
  {
    name: "get_object",
    description:
      "Get an object. Returns a presigned URL for download (safer for large files).",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
        expiry: {
          type: "number",
          description: "Presigned URL expiry in seconds (default: 3600)",
        },
      },
      required: ["bucket", "objectName"],
    },
  },
  {
    name: "put_object",
    description: "Upload an object to a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
        content: {
          type: "string",
          description: "Content (text or base64 for binary)",
        },
        contentType: {
          type: "string",
          description: "MIME type (default: application/octet-stream)",
        },
        metadata: {
          type: "object",
          description: "Custom metadata key-value pairs",
        },
      },
      required: ["bucket", "objectName", "content"],
    },
  },
  {
    name: "delete_object",
    description: "Delete a single object from a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
        versionId: {
          type: "string",
          description: "Version ID (for versioned buckets)",
        },
      },
      required: ["bucket", "objectName"],
    },
  },
  {
    name: "delete_objects",
    description: "Delete multiple objects from a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Object key/name" },
              versionId: { type: "string", description: "Version ID" },
            },
            required: ["name"],
          },
          description: "Array of objects to delete",
        },
      },
      required: ["bucket", "objects"],
    },
  },
  {
    name: "copy_object",
    description: "Copy an object from one location to another.",
    inputSchema: {
      type: "object",
      properties: {
        sourceBucket: { type: "string", description: "Source bucket name" },
        sourceObject: { type: "string", description: "Source object key" },
        destBucket: { type: "string", description: "Destination bucket name" },
        destObject: { type: "string", description: "Destination object key" },
      },
      required: ["sourceBucket", "sourceObject", "destBucket", "destObject"],
    },
  },
  {
    name: "get_object_info",
    description: "Get object metadata and information.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
      },
      required: ["bucket", "objectName"],
    },
  },
  // Object tagging
  {
    name: "set_object_tags",
    description: "Set tags on an object.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
        tags: {
          type: "object",
          description: "Tags as key-value pairs",
        },
      },
      required: ["bucket", "objectName", "tags"],
    },
  },
  {
    name: "get_object_tags",
    description: "Get tags of an object.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
      },
      required: ["bucket", "objectName"],
    },
  },
  // Presigned URLs
  {
    name: "presigned_get",
    description: "Generate a presigned URL for downloading an object.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
        expiry: {
          type: "number",
          description: "URL expiry in seconds (default: 7 days, max: 7 days)",
        },
        responseHeaders: {
          type: "object",
          description: "Response headers to override (Content-Type, etc.)",
        },
      },
      required: ["bucket", "objectName"],
    },
  },
  {
    name: "presigned_put",
    description: "Generate a presigned URL for uploading an object.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
        expiry: {
          type: "number",
          description: "URL expiry in seconds (default: 7 days, max: 7 days)",
        },
      },
      required: ["bucket", "objectName"],
    },
  },
  // Multipart upload management
  {
    name: "list_incomplete_uploads",
    description: "List incomplete multipart uploads in a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        prefix: { type: "string", description: "Filter by prefix" },
        recursive: { type: "boolean", description: "List recursively" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "remove_incomplete_upload",
    description: "Remove an incomplete multipart upload.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        objectName: { type: "string", description: "Object key/name" },
      },
      required: ["bucket", "objectName"],
    },
  },
  // Versioning
  {
    name: "get_bucket_versioning",
    description: "Get versioning configuration of a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "set_bucket_versioning",
    description: "Set versioning configuration of a bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        enabled: {
          type: "boolean",
          description: "Enable or suspend versioning",
        },
      },
      required: ["bucket", "enabled"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function listBuckets(): Promise<any> {
  const buckets = await minio.listBuckets();
  return {
    buckets: buckets.map((b) => ({
      name: b.name,
      creationDate: b.creationDate,
    })),
    count: buckets.length,
  };
}

async function createBucket(params: {
  bucket: string;
  region?: string;
}): Promise<any> {
  await minio.makeBucket(params.bucket, params.region || "");
  return {
    bucket: params.bucket,
    region: params.region || "us-east-1",
    created: true,
  };
}

async function deleteBucket(params: { bucket: string }): Promise<any> {
  await minio.removeBucket(params.bucket);
  return { bucket: params.bucket, deleted: true };
}

async function getBucketPolicy(params: { bucket: string }): Promise<any> {
  try {
    const policy = await minio.getBucketPolicy(params.bucket);
    return {
      bucket: params.bucket,
      policy: JSON.parse(policy),
    };
  } catch (error: any) {
    if (error.code === "NoSuchBucketPolicy") {
      return { bucket: params.bucket, policy: null, message: "No policy set" };
    }
    throw error;
  }
}

async function setBucketPolicy(params: {
  bucket: string;
  policy: string;
}): Promise<any> {
  // Validate JSON
  const policyObj = JSON.parse(params.policy);
  await minio.setBucketPolicy(params.bucket, JSON.stringify(policyObj));
  return { bucket: params.bucket, policySet: true };
}

async function listObjects(params: {
  bucket: string;
  prefix?: string;
  recursive?: boolean;
  maxKeys?: number;
}): Promise<any> {
  const objects: any[] = [];
  const stream = minio.listObjectsV2(
    params.bucket,
    params.prefix || "",
    params.recursive || false
  );

  return new Promise((resolve, reject) => {
    stream.on("data", (obj) => {
      if (!params.maxKeys || objects.length < params.maxKeys) {
        objects.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          etag: obj.etag,
          prefix: obj.prefix,
        });
      }
    });
    stream.on("end", () =>
      resolve({
        bucket: params.bucket,
        prefix: params.prefix || "",
        objects,
        count: objects.length,
        truncated: params.maxKeys ? objects.length >= params.maxKeys : false,
      })
    );
    stream.on("error", reject);
  });
}

async function getObject(params: {
  bucket: string;
  objectName: string;
  expiry?: number;
}): Promise<any> {
  // Return presigned URL instead of content (safer for large files)
  const expiry = params.expiry || 3600; // 1 hour default
  const url = await minio.presignedGetObject(
    params.bucket,
    params.objectName,
    expiry
  );

  // Also get object stats
  const stat = await minio.statObject(params.bucket, params.objectName);

  return {
    bucket: params.bucket,
    objectName: params.objectName,
    size: stat.size,
    lastModified: stat.lastModified,
    etag: stat.etag,
    contentType: stat.metaData?.["content-type"],
    downloadUrl: url,
    urlExpiry: expiry,
  };
}

async function putObject(params: {
  bucket: string;
  objectName: string;
  content: string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<any> {
  // Detect if content is base64 encoded
  const isBase64 =
    params.content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(params.content);
  const buffer = Buffer.from(params.content, isBase64 ? "base64" : "utf-8");

  const metaData: Record<string, string> = {
    "Content-Type": params.contentType || "application/octet-stream",
    ...params.metadata,
  };

  const result = await minio.putObject(
    params.bucket,
    params.objectName,
    buffer,
    buffer.length,
    metaData
  );

  return {
    bucket: params.bucket,
    objectName: params.objectName,
    etag: result.etag,
    versionId: result.versionId,
    size: buffer.length,
    uploaded: true,
  };
}

async function deleteObject(params: {
  bucket: string;
  objectName: string;
  versionId?: string;
}): Promise<any> {
  const removeOptions: Minio.RemoveOptions = {};
  if (params.versionId) {
    removeOptions.versionId = params.versionId;
  }
  await minio.removeObject(params.bucket, params.objectName, removeOptions);
  return {
    bucket: params.bucket,
    objectName: params.objectName,
    versionId: params.versionId,
    deleted: true,
  };
}

async function deleteObjects(params: {
  bucket: string;
  objects: Array<{ name: string; versionId?: string }>;
}): Promise<any> {
  const objectsList = params.objects.map((obj) => ({
    name: obj.name,
    versionId: obj.versionId,
  }));

  await minio.removeObjects(params.bucket, objectsList);

  return {
    bucket: params.bucket,
    deletedCount: params.objects.length,
    objects: params.objects,
    deleted: true,
  };
}

async function copyObject(params: {
  sourceBucket: string;
  sourceObject: string;
  destBucket: string;
  destObject: string;
}): Promise<any> {
  const conds = new Minio.CopyConditions();

  await minio.copyObject(
    params.destBucket,
    params.destObject,
    `/${params.sourceBucket}/${params.sourceObject}`,
    conds
  );

  return {
    source: `${params.sourceBucket}/${params.sourceObject}`,
    destination: `${params.destBucket}/${params.destObject}`,
    copied: true,
  };
}

async function getObjectInfo(params: {
  bucket: string;
  objectName: string;
}): Promise<any> {
  const stat = await minio.statObject(params.bucket, params.objectName);
  return {
    bucket: params.bucket,
    objectName: params.objectName,
    size: stat.size,
    lastModified: stat.lastModified,
    etag: stat.etag,
    versionId: stat.versionId,
    metaData: stat.metaData,
  };
}

async function setObjectTags(params: {
  bucket: string;
  objectName: string;
  tags: Record<string, string>;
}): Promise<any> {
  await minio.setObjectTagging(params.bucket, params.objectName, params.tags);
  return {
    bucket: params.bucket,
    objectName: params.objectName,
    tags: params.tags,
    set: true,
  };
}

async function getObjectTags(params: {
  bucket: string;
  objectName: string;
}): Promise<any> {
  const tags = await minio.getObjectTagging(params.bucket, params.objectName);
  return {
    bucket: params.bucket,
    objectName: params.objectName,
    tags,
  };
}

async function presignedGet(params: {
  bucket: string;
  objectName: string;
  expiry?: number;
  responseHeaders?: Record<string, string>;
}): Promise<any> {
  const expiry = Math.min(params.expiry || 7 * 24 * 60 * 60, 7 * 24 * 60 * 60); // Max 7 days

  const reqParams: Record<string, string> = {};
  if (params.responseHeaders) {
    if (params.responseHeaders["Content-Type"]) {
      reqParams["response-content-type"] = params.responseHeaders["Content-Type"];
    }
    if (params.responseHeaders["Content-Disposition"]) {
      reqParams["response-content-disposition"] =
        params.responseHeaders["Content-Disposition"];
    }
  }

  const url = await minio.presignedGetObject(
    params.bucket,
    params.objectName,
    expiry,
    reqParams
  );

  return {
    bucket: params.bucket,
    objectName: params.objectName,
    url,
    expiry,
    expiresAt: new Date(Date.now() + expiry * 1000).toISOString(),
  };
}

async function presignedPut(params: {
  bucket: string;
  objectName: string;
  expiry?: number;
}): Promise<any> {
  const expiry = Math.min(params.expiry || 7 * 24 * 60 * 60, 7 * 24 * 60 * 60); // Max 7 days

  const url = await minio.presignedPutObject(
    params.bucket,
    params.objectName,
    expiry
  );

  return {
    bucket: params.bucket,
    objectName: params.objectName,
    url,
    expiry,
    expiresAt: new Date(Date.now() + expiry * 1000).toISOString(),
  };
}

async function listIncompleteUploads(params: {
  bucket: string;
  prefix?: string;
  recursive?: boolean;
}): Promise<any> {
  const uploads: any[] = [];
  const stream = minio.listIncompleteUploads(
    params.bucket,
    params.prefix || "",
    params.recursive || false
  );

  return new Promise((resolve, reject) => {
    stream.on("data", (upload) => {
      uploads.push({
        key: upload.key,
        uploadId: upload.uploadId,
        size: upload.size,
      });
    });
    stream.on("end", () =>
      resolve({
        bucket: params.bucket,
        prefix: params.prefix || "",
        uploads,
        count: uploads.length,
      })
    );
    stream.on("error", reject);
  });
}

async function removeIncompleteUpload(params: {
  bucket: string;
  objectName: string;
}): Promise<any> {
  await minio.removeIncompleteUpload(params.bucket, params.objectName);
  return {
    bucket: params.bucket,
    objectName: params.objectName,
    removed: true,
  };
}

async function getBucketVersioning(params: { bucket: string }): Promise<any> {
  const versioningConfig = await minio.getBucketVersioning(params.bucket);
  return {
    bucket: params.bucket,
    status: versioningConfig.Status || "Disabled",
    mfaDelete: versioningConfig.MFADelete,
  };
}

async function setBucketVersioning(params: {
  bucket: string;
  enabled: boolean;
}): Promise<any> {
  const versioningConfig = {
    Status: params.enabled ? "Enabled" : "Suspended",
  } as Minio.VersioningConfig;

  await minio.setBucketVersioning(params.bucket, versioningConfig);

  return {
    bucket: params.bucket,
    versioning: params.enabled ? "Enabled" : "Suspended",
    set: true,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "minio-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Bucket operations
      case "list_buckets":
        result = await listBuckets();
        break;
      case "create_bucket":
        result = await createBucket(args as any);
        break;
      case "delete_bucket":
        result = await deleteBucket(args as any);
        break;
      case "get_bucket_policy":
        result = await getBucketPolicy(args as any);
        break;
      case "set_bucket_policy":
        result = await setBucketPolicy(args as any);
        break;

      // Object operations
      case "list_objects":
        result = await listObjects(args as any);
        break;
      case "get_object":
        result = await getObject(args as any);
        break;
      case "put_object":
        result = await putObject(args as any);
        break;
      case "delete_object":
        result = await deleteObject(args as any);
        break;
      case "delete_objects":
        result = await deleteObjects(args as any);
        break;
      case "copy_object":
        result = await copyObject(args as any);
        break;
      case "get_object_info":
        result = await getObjectInfo(args as any);
        break;

      // Object tagging
      case "set_object_tags":
        result = await setObjectTags(args as any);
        break;
      case "get_object_tags":
        result = await getObjectTags(args as any);
        break;

      // Presigned URLs
      case "presigned_get":
        result = await presignedGet(args as any);
        break;
      case "presigned_put":
        result = await presignedPut(args as any);
        break;

      // Multipart uploads
      case "list_incomplete_uploads":
        result = await listIncompleteUploads(args as any);
        break;
      case "remove_incomplete_upload":
        result = await removeIncompleteUpload(args as any);
        break;

      // Versioning
      case "get_bucket_versioning":
        result = await getBucketVersioning(args as any);
        break;
      case "set_bucket_versioning":
        result = await setBucketVersioning(args as any);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.message,
            code: error.code,
            bucket: (args as any)?.bucket,
            objectName: (args as any)?.objectName,
          }),
        },
      ],
      isError: true,
    };
  }
});

// =============================================================================
// Main
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MinIO MCP Server running on stdio");
  console.error(`Endpoint: ${config.endPoint}:${config.port}`);
  console.error(`SSL: ${config.useSSL}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
