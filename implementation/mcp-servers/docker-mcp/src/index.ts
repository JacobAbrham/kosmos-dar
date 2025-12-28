/**
 * Docker MCP Server
 *
 * Provides Docker Engine API management for KOSMOS agents.
 * Features:
 * - Container lifecycle (create, start, stop, restart, remove)
 * - Container logs and exec command
 * - Image management (list, pull, remove, tag, build)
 * - Volume operations (list, create, remove)
 * - Network operations (list, create, connect)
 * - System info and prune
 *
 * Authentication: Uses DOCKER_HOST environment variable (defaults to unix socket).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import Docker from "dockerode";

// =============================================================================
// Configuration
// =============================================================================

function getDockerConfig(): Docker.DockerOptions {
  const dockerHost = process.env.DOCKER_HOST;

  if (dockerHost) {
    // Parse DOCKER_HOST format: tcp://host:port or unix:///var/run/docker.sock
    if (dockerHost.startsWith("tcp://")) {
      const url = new URL(dockerHost);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 2375,
        protocol: "http",
      };
    } else if (dockerHost.startsWith("unix://")) {
      return {
        socketPath: dockerHost.replace("unix://", ""),
      };
    } else if (dockerHost.startsWith("npipe://")) {
      // Windows named pipe
      return {
        socketPath: dockerHost.replace("npipe://", ""),
      };
    }
  }

  // Default to unix socket on Linux/macOS or named pipe on Windows
  const isWindows = process.platform === "win32";
  return {
    socketPath: isWindows
      ? "//./pipe/docker_engine"
      : "/var/run/docker.sock",
  };
}

const docker = new Docker(getDockerConfig());

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Container operations
  {
    name: "list_containers",
    description: "List Docker containers. Returns container IDs, names, images, states, and ports.",
    inputSchema: {
      type: "object",
      properties: {
        all: {
          type: "boolean",
          description: "Include stopped containers (default: false, only running)",
        },
        limit: {
          type: "number",
          description: "Maximum number of containers to return",
        },
        filters: {
          type: "object",
          description: "Filters as JSON object (e.g., {status: ['running'], name: ['myapp']})",
        },
      },
    },
  },
  {
    name: "get_container",
    description: "Get detailed information about a specific container including config, state, network, and mounts.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: {
          type: "string",
          description: "Container ID or name",
        },
      },
      required: ["containerId"],
    },
  },
  {
    name: "create_container",
    description: "Create a new Docker container from an image. Does not start the container automatically.",
    inputSchema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          description: "Image name (e.g., 'nginx:latest', 'ubuntu:22.04')",
        },
        name: {
          type: "string",
          description: "Container name (optional, Docker will generate one if not provided)",
        },
        cmd: {
          type: "array",
          items: { type: "string" },
          description: "Command to run (e.g., ['npm', 'start'])",
        },
        env: {
          type: "array",
          items: { type: "string" },
          description: "Environment variables in KEY=value format (e.g., ['NODE_ENV=production'])",
        },
        ports: {
          type: "object",
          description: "Port bindings (e.g., {'80/tcp': [{'HostPort': '8080'}]})",
        },
        volumes: {
          type: "object",
          description: "Volume bindings as host:container mapping (e.g., {'/host/path': '/container/path'})",
        },
        networkMode: {
          type: "string",
          description: "Network mode (e.g., 'bridge', 'host', 'none', or network name)",
        },
        restart: {
          type: "string",
          enum: ["no", "always", "unless-stopped", "on-failure"],
          description: "Restart policy",
        },
        workingDir: {
          type: "string",
          description: "Working directory inside the container",
        },
        user: {
          type: "string",
          description: "User to run as (e.g., 'node', '1000:1000')",
        },
      },
      required: ["image"],
    },
  },
  {
    name: "start_container",
    description: "Start a stopped container.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: {
          type: "string",
          description: "Container ID or name",
        },
      },
      required: ["containerId"],
    },
  },
  {
    name: "stop_container",
    description: "Stop a running container gracefully.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: {
          type: "string",
          description: "Container ID or name",
        },
        timeout: {
          type: "number",
          description: "Seconds to wait before killing the container (default: 10)",
        },
      },
      required: ["containerId"],
    },
  },
  {
    name: "restart_container",
    description: "Restart a container (stop and start).",
    inputSchema: {
      type: "object",
      properties: {
        containerId: {
          type: "string",
          description: "Container ID or name",
        },
        timeout: {
          type: "number",
          description: "Seconds to wait before killing during stop (default: 10)",
        },
      },
      required: ["containerId"],
    },
  },
  {
    name: "remove_container",
    description: "Remove a container. Container must be stopped unless force is true.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: {
          type: "string",
          description: "Container ID or name",
        },
        force: {
          type: "boolean",
          description: "Force remove a running container (default: false)",
        },
        removeVolumes: {
          type: "boolean",
          description: "Remove associated anonymous volumes (default: false)",
        },
      },
      required: ["containerId"],
    },
  },
  {
    name: "get_container_logs",
    description: "Get stdout and stderr logs from a container.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: {
          type: "string",
          description: "Container ID or name",
        },
        tail: {
          type: "number",
          description: "Number of lines from the end of logs (default: 100)",
        },
        since: {
          type: "number",
          description: "Unix timestamp to start logs from",
        },
        until: {
          type: "number",
          description: "Unix timestamp to end logs at",
        },
        timestamps: {
          type: "boolean",
          description: "Include timestamps in output (default: false)",
        },
      },
      required: ["containerId"],
    },
  },
  {
    name: "exec_command",
    description: "Execute a command inside a running container and return the output.",
    inputSchema: {
      type: "object",
      properties: {
        containerId: {
          type: "string",
          description: "Container ID or name",
        },
        cmd: {
          type: "array",
          items: { type: "string" },
          description: "Command to execute (e.g., ['ls', '-la'] or ['bash', '-c', 'echo hello'])",
        },
        workdir: {
          type: "string",
          description: "Working directory for the command",
        },
        user: {
          type: "string",
          description: "User to run command as",
        },
        env: {
          type: "array",
          items: { type: "string" },
          description: "Additional environment variables for the command",
        },
      },
      required: ["containerId", "cmd"],
    },
  },
  // Image operations
  {
    name: "list_images",
    description: "List Docker images on the host.",
    inputSchema: {
      type: "object",
      properties: {
        all: {
          type: "boolean",
          description: "Include intermediate images (default: false)",
        },
        filters: {
          type: "object",
          description: "Filters (e.g., {reference: ['nginx:*'], dangling: ['true']})",
        },
      },
    },
  },
  {
    name: "pull_image",
    description: "Pull an image from a registry (Docker Hub by default).",
    inputSchema: {
      type: "object",
      properties: {
        image: {
          type: "string",
          description: "Image name with optional tag (e.g., 'nginx:latest', 'ghcr.io/owner/repo:tag')",
        },
        auth: {
          type: "object",
          properties: {
            username: { type: "string" },
            password: { type: "string" },
            serveraddress: { type: "string" },
          },
          description: "Registry authentication credentials",
        },
      },
      required: ["image"],
    },
  },
  {
    name: "remove_image",
    description: "Remove an image from the host.",
    inputSchema: {
      type: "object",
      properties: {
        imageId: {
          type: "string",
          description: "Image ID or name:tag",
        },
        force: {
          type: "boolean",
          description: "Force removal even if used by containers (default: false)",
        },
        noPrune: {
          type: "boolean",
          description: "Do not delete untagged parent images (default: false)",
        },
      },
      required: ["imageId"],
    },
  },
  {
    name: "tag_image",
    description: "Create a tag that refers to an image.",
    inputSchema: {
      type: "object",
      properties: {
        sourceImage: {
          type: "string",
          description: "Source image name or ID",
        },
        repo: {
          type: "string",
          description: "Repository name for the new tag (e.g., 'myregistry.com/myimage')",
        },
        tag: {
          type: "string",
          description: "Tag name (e.g., 'v1.0.0', 'latest')",
        },
      },
      required: ["sourceImage", "repo"],
    },
  },
  {
    name: "build_image",
    description: "Build an image from a Dockerfile. Requires the build context path.",
    inputSchema: {
      type: "object",
      properties: {
        contextPath: {
          type: "string",
          description: "Path to the build context directory containing Dockerfile",
        },
        dockerfile: {
          type: "string",
          description: "Path to Dockerfile relative to context (default: 'Dockerfile')",
        },
        tag: {
          type: "string",
          description: "Tag for the built image (e.g., 'myapp:latest')",
        },
        buildArgs: {
          type: "object",
          description: "Build-time variables as key-value pairs",
        },
        noCache: {
          type: "boolean",
          description: "Do not use cache when building (default: false)",
        },
        pull: {
          type: "boolean",
          description: "Always pull base images (default: false)",
        },
        target: {
          type: "string",
          description: "Target build stage for multi-stage builds",
        },
      },
      required: ["contextPath"],
    },
  },
  // Volume operations
  {
    name: "list_volumes",
    description: "List Docker volumes.",
    inputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Filters (e.g., {driver: ['local'], name: ['myvolume']})",
        },
      },
    },
  },
  {
    name: "create_volume",
    description: "Create a Docker volume for persistent data storage.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Volume name",
        },
        driver: {
          type: "string",
          description: "Volume driver (default: 'local')",
        },
        driverOpts: {
          type: "object",
          description: "Driver-specific options",
        },
        labels: {
          type: "object",
          description: "Labels to apply to the volume",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "remove_volume",
    description: "Remove a Docker volume. Volume must not be in use.",
    inputSchema: {
      type: "object",
      properties: {
        volumeName: {
          type: "string",
          description: "Volume name",
        },
        force: {
          type: "boolean",
          description: "Force removal (default: false)",
        },
      },
      required: ["volumeName"],
    },
  },
  // Network operations
  {
    name: "list_networks",
    description: "List Docker networks.",
    inputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Filters (e.g., {driver: ['bridge'], name: ['mynetwork']})",
        },
      },
    },
  },
  {
    name: "create_network",
    description: "Create a Docker network for container communication.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Network name",
        },
        driver: {
          type: "string",
          description: "Network driver: 'bridge', 'overlay', 'macvlan', 'none' (default: 'bridge')",
        },
        internal: {
          type: "boolean",
          description: "Restrict external access to the network (default: false)",
        },
        attachable: {
          type: "boolean",
          description: "Allow manual container attachment (default: false)",
        },
        ipam: {
          type: "object",
          description: "IPAM configuration for custom subnets",
        },
        labels: {
          type: "object",
          description: "Labels to apply to the network",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "connect_network",
    description: "Connect a container to a network.",
    inputSchema: {
      type: "object",
      properties: {
        networkId: {
          type: "string",
          description: "Network ID or name",
        },
        containerId: {
          type: "string",
          description: "Container ID or name to connect",
        },
        aliases: {
          type: "array",
          items: { type: "string" },
          description: "Network aliases for the container",
        },
        ipv4Address: {
          type: "string",
          description: "IPv4 address to assign to the container",
        },
        ipv6Address: {
          type: "string",
          description: "IPv6 address to assign to the container",
        },
      },
      required: ["networkId", "containerId"],
    },
  },
  // System operations
  {
    name: "get_system_info",
    description: "Get Docker daemon system-wide information including version, resources, and configuration.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "prune",
    description: "Remove unused Docker resources (containers, images, networks, volumes).",
    inputSchema: {
      type: "object",
      properties: {
        containers: {
          type: "boolean",
          description: "Prune stopped containers (default: true)",
        },
        images: {
          type: "boolean",
          description: "Prune dangling images (default: false)",
        },
        networks: {
          type: "boolean",
          description: "Prune unused networks (default: true)",
        },
        volumes: {
          type: "boolean",
          description: "Prune unused volumes (default: false, use with caution)",
        },
        allImages: {
          type: "boolean",
          description: "Prune all unused images, not just dangling ones (default: false)",
        },
      },
    },
  },
];

// =============================================================================
// Utility Functions
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function listContainers(params: {
  all?: boolean;
  limit?: number;
  filters?: Record<string, string[]>;
}): Promise<object> {
  const containers = await docker.listContainers({
    all: params.all,
    limit: params.limit,
    filters: params.filters,
  });

  return {
    containers: containers.map((c) => ({
      id: c.Id.slice(0, 12),
      names: c.Names.map((n) => n.replace(/^\//, "")),
      image: c.Image,
      imageId: c.ImageID.slice(7, 19),
      state: c.State,
      status: c.Status,
      ports: c.Ports.map((p) => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
        ip: p.IP,
      })),
      created: new Date(c.Created * 1000).toISOString(),
      labels: c.Labels,
    })),
    count: containers.length,
  };
}

async function getContainer(params: { containerId: string }): Promise<object> {
  const container = docker.getContainer(params.containerId);
  const info = await container.inspect();

  return {
    id: info.Id.slice(0, 12),
    fullId: info.Id,
    name: info.Name.replace(/^\//, ""),
    image: info.Config.Image,
    imageId: info.Image,
    state: {
      status: info.State.Status,
      running: info.State.Running,
      paused: info.State.Paused,
      restarting: info.State.Restarting,
      pid: info.State.Pid,
      exitCode: info.State.ExitCode,
      startedAt: info.State.StartedAt,
      finishedAt: info.State.FinishedAt,
    },
    config: {
      hostname: info.Config.Hostname,
      user: info.Config.User,
      env: info.Config.Env,
      cmd: info.Config.Cmd,
      entrypoint: info.Config.Entrypoint,
      workingDir: info.Config.WorkingDir,
      labels: info.Config.Labels,
      exposedPorts: info.Config.ExposedPorts,
    },
    hostConfig: {
      networkMode: info.HostConfig.NetworkMode,
      portBindings: info.HostConfig.PortBindings,
      restartPolicy: info.HostConfig.RestartPolicy,
      binds: info.HostConfig.Binds,
      memory: info.HostConfig.Memory,
      cpuShares: info.HostConfig.CpuShares,
    },
    networkSettings: {
      networks: info.NetworkSettings.Networks,
      ipAddress: info.NetworkSettings.IPAddress,
      gateway: info.NetworkSettings.Gateway,
      ports: info.NetworkSettings.Ports,
    },
    mounts: info.Mounts?.map((m) => ({
      type: m.Type,
      source: m.Source,
      destination: m.Destination,
      mode: m.Mode,
      rw: m.RW,
    })),
    created: info.Created,
  };
}

async function createContainer(params: {
  image: string;
  name?: string;
  cmd?: string[];
  env?: string[];
  ports?: Record<string, Array<{ HostPort: string; HostIp?: string }>>;
  volumes?: Record<string, string>;
  networkMode?: string;
  restart?: string;
  workingDir?: string;
  user?: string;
}): Promise<object> {
  const createOptions: Docker.ContainerCreateOptions = {
    Image: params.image,
    name: params.name,
    Cmd: params.cmd,
    Env: params.env,
    WorkingDir: params.workingDir,
    User: params.user,
    HostConfig: {
      PortBindings: params.ports,
      Binds: params.volumes
        ? Object.entries(params.volumes).map(([host, container]) => `${host}:${container}`)
        : undefined,
      NetworkMode: params.networkMode,
      RestartPolicy: params.restart
        ? { Name: params.restart as "no" | "always" | "unless-stopped" | "on-failure" }
        : undefined,
    },
  };

  const container = await docker.createContainer(createOptions);
  const info = await container.inspect();

  return {
    id: container.id.slice(0, 12),
    fullId: container.id,
    name: params.name || info.Name.replace(/^\//, ""),
    image: params.image,
    created: true,
    message: `Container created successfully. Use start_container to run it.`,
  };
}

async function startContainer(params: { containerId: string }): Promise<object> {
  const container = docker.getContainer(params.containerId);
  await container.start();
  const info = await container.inspect();

  return {
    containerId: params.containerId,
    id: info.Id.slice(0, 12),
    name: info.Name.replace(/^\//, ""),
    started: true,
    state: info.State.Status,
  };
}

async function stopContainer(params: {
  containerId: string;
  timeout?: number;
}): Promise<object> {
  const container = docker.getContainer(params.containerId);
  await container.stop({ t: params.timeout ?? 10 });

  return {
    containerId: params.containerId,
    stopped: true,
    timeout: params.timeout ?? 10,
  };
}

async function restartContainer(params: {
  containerId: string;
  timeout?: number;
}): Promise<object> {
  const container = docker.getContainer(params.containerId);
  await container.restart({ t: params.timeout ?? 10 });
  const info = await container.inspect();

  return {
    containerId: params.containerId,
    id: info.Id.slice(0, 12),
    restarted: true,
    state: info.State.Status,
  };
}

async function removeContainer(params: {
  containerId: string;
  force?: boolean;
  removeVolumes?: boolean;
}): Promise<object> {
  const container = docker.getContainer(params.containerId);
  await container.remove({
    force: params.force,
    v: params.removeVolumes,
  });

  return {
    containerId: params.containerId,
    removed: true,
    force: params.force ?? false,
    volumesRemoved: params.removeVolumes ?? false,
  };
}

async function getContainerLogs(params: {
  containerId: string;
  tail?: number;
  since?: number;
  until?: number;
  timestamps?: boolean;
}): Promise<object> {
  const container = docker.getContainer(params.containerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail: params.tail ?? 100,
    since: params.since,
    until: params.until,
    timestamps: params.timestamps,
  });

  // Docker logs have a multiplexed stream format with 8-byte headers
  // We need to strip these headers to get clean output
  const logString = logs.toString("utf-8");

  return {
    containerId: params.containerId,
    tail: params.tail ?? 100,
    timestamps: params.timestamps ?? false,
    logs: logString,
  };
}

async function execCommand(params: {
  containerId: string;
  cmd: string[];
  workdir?: string;
  user?: string;
  env?: string[];
}): Promise<object> {
  const container = docker.getContainer(params.containerId);

  const exec = await container.exec({
    Cmd: params.cmd,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: params.workdir,
    User: params.user,
    Env: params.env,
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  const output = await new Promise<string>((resolve, reject) => {
    let data = "";
    stream.on("data", (chunk: Buffer) => {
      // Strip Docker stream headers (8 bytes per frame)
      data += chunk.toString("utf-8");
    });
    stream.on("end", () => resolve(data));
    stream.on("error", reject);
  });

  const inspectResult = await exec.inspect();

  return {
    containerId: params.containerId,
    cmd: params.cmd.join(" "),
    exitCode: inspectResult.ExitCode,
    output: output.trim(),
  };
}

async function listImages(params: {
  all?: boolean;
  filters?: Record<string, string[]>;
}): Promise<object> {
  const images = await docker.listImages({
    all: params.all,
    filters: params.filters,
  });

  return {
    images: images.map((img) => ({
      id: img.Id.slice(7, 19),
      fullId: img.Id,
      repoTags: img.RepoTags || [],
      repoDigests: img.RepoDigests || [],
      size: formatBytes(img.Size),
      sizeBytes: img.Size,
      created: new Date(img.Created * 1000).toISOString(),
      labels: img.Labels,
    })),
    count: images.length,
  };
}

async function pullImage(params: {
  image: string;
  auth?: { username: string; password: string; serveraddress?: string };
}): Promise<object> {
  const stream = await docker.pull(params.image, {
    authconfig: params.auth,
  });

  const pullOutput: string[] = [];

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: Error | null, output: Array<{ status: string; progress?: string }>) => {
        if (err) reject(err);
        else resolve();
      },
      (event: { status: string; progress?: string }) => {
        if (event.status) {
          pullOutput.push(event.status + (event.progress ? ` ${event.progress}` : ""));
        }
      }
    );
  });

  return {
    image: params.image,
    pulled: true,
    output: pullOutput.slice(-10), // Last 10 status messages
  };
}

async function removeImage(params: {
  imageId: string;
  force?: boolean;
  noPrune?: boolean;
}): Promise<object> {
  const image = docker.getImage(params.imageId);
  const result = await image.remove({
    force: params.force,
    noprune: params.noPrune,
  });

  return {
    imageId: params.imageId,
    removed: true,
    details: result,
  };
}

async function tagImage(params: {
  sourceImage: string;
  repo: string;
  tag?: string;
}): Promise<object> {
  const image = docker.getImage(params.sourceImage);
  await image.tag({
    repo: params.repo,
    tag: params.tag || "latest",
  });

  return {
    sourceImage: params.sourceImage,
    newTag: `${params.repo}:${params.tag || "latest"}`,
    tagged: true,
  };
}

async function buildImage(params: {
  contextPath: string;
  dockerfile?: string;
  tag?: string;
  buildArgs?: Record<string, string>;
  noCache?: boolean;
  pull?: boolean;
  target?: string;
}): Promise<object> {
  // For building, we need to create a tar stream of the context
  // This is a simplified implementation - in production you'd use tar-fs
  const fs = await import("fs");
  const path = await import("path");
  const { Pack } = await import("tar");

  const contextPath = path.resolve(params.contextPath);

  // Check if context path exists
  if (!fs.existsSync(contextPath)) {
    throw new Error(`Build context path does not exist: ${contextPath}`);
  }

  // Create tar stream from context directory
  const tarStream = new Pack({ cwd: contextPath });

  // Add all files from context
  const files = fs.readdirSync(contextPath);
  for (const file of files) {
    tarStream.add(file);
  }
  tarStream.end();

  const buildStream = await docker.buildImage(tarStream as unknown as NodeJS.ReadableStream, {
    t: params.tag,
    dockerfile: params.dockerfile || "Dockerfile",
    buildargs: params.buildArgs,
    nocache: params.noCache,
    pull: params.pull ? "true" : undefined,
    target: params.target,
  });

  const buildOutput: string[] = [];

  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      buildStream,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      },
      (event: { stream?: string; error?: string }) => {
        if (event.stream) {
          buildOutput.push(event.stream.trim());
        }
        if (event.error) {
          buildOutput.push(`ERROR: ${event.error}`);
        }
      }
    );
  });

  return {
    tag: params.tag || "(untagged)",
    contextPath: params.contextPath,
    dockerfile: params.dockerfile || "Dockerfile",
    built: true,
    output: buildOutput.filter((l) => l).slice(-20), // Last 20 non-empty lines
  };
}

async function listVolumes(params: {
  filters?: Record<string, string[]>;
}): Promise<object> {
  const result = await docker.listVolumes({ filters: params.filters });

  return {
    volumes: (result.Volumes || []).map((vol) => ({
      name: vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      scope: vol.Scope,
      labels: vol.Labels,
      options: vol.Options,
      createdAt: vol.CreatedAt,
    })),
    count: result.Volumes?.length || 0,
    warnings: result.Warnings,
  };
}

async function createVolume(params: {
  name: string;
  driver?: string;
  driverOpts?: Record<string, string>;
  labels?: Record<string, string>;
}): Promise<object> {
  const volume = await docker.createVolume({
    Name: params.name,
    Driver: params.driver || "local",
    DriverOpts: params.driverOpts,
    Labels: params.labels,
  });

  return {
    name: volume.name,
    driver: params.driver || "local",
    created: true,
  };
}

async function removeVolume(params: {
  volumeName: string;
  force?: boolean;
}): Promise<object> {
  const volume = docker.getVolume(params.volumeName);
  await volume.remove({ force: params.force });

  return {
    volumeName: params.volumeName,
    removed: true,
  };
}

async function listNetworks(params: {
  filters?: Record<string, string[]>;
}): Promise<object> {
  const networks = await docker.listNetworks({ filters: params.filters });

  return {
    networks: networks.map((net) => ({
      id: net.Id.slice(0, 12),
      fullId: net.Id,
      name: net.Name,
      driver: net.Driver,
      scope: net.Scope,
      internal: net.Internal,
      attachable: net.Attachable,
      ipam: net.IPAM,
      containers: net.Containers,
      labels: net.Labels,
      created: net.Created,
    })),
    count: networks.length,
  };
}

async function createNetwork(params: {
  name: string;
  driver?: string;
  internal?: boolean;
  attachable?: boolean;
  ipam?: {
    Driver?: string;
    Config?: Array<{ Subnet?: string; Gateway?: string; IPRange?: string }>;
  };
  labels?: Record<string, string>;
}): Promise<object> {
  const network = await docker.createNetwork({
    Name: params.name,
    Driver: params.driver || "bridge",
    Internal: params.internal,
    Attachable: params.attachable,
    IPAM: params.ipam,
    Labels: params.labels,
  });

  return {
    id: network.id.slice(0, 12),
    fullId: network.id,
    name: params.name,
    driver: params.driver || "bridge",
    created: true,
  };
}

async function connectNetwork(params: {
  networkId: string;
  containerId: string;
  aliases?: string[];
  ipv4Address?: string;
  ipv6Address?: string;
}): Promise<object> {
  const network = docker.getNetwork(params.networkId);

  await network.connect({
    Container: params.containerId,
    EndpointConfig: {
      Aliases: params.aliases,
      IPAMConfig: {
        IPv4Address: params.ipv4Address,
        IPv6Address: params.ipv6Address,
      },
    },
  });

  return {
    networkId: params.networkId,
    containerId: params.containerId,
    connected: true,
    aliases: params.aliases,
    ipv4Address: params.ipv4Address,
  };
}

async function getSystemInfo(): Promise<object> {
  const info = await docker.info();
  const version = await docker.version();

  return {
    // Docker version info
    version: {
      version: version.Version,
      apiVersion: version.ApiVersion,
      minApiVersion: version.MinAPIVersion,
      gitCommit: version.GitCommit,
      goVersion: version.GoVersion,
      os: version.Os,
      arch: version.Arch,
      kernelVersion: version.KernelVersion,
      buildTime: version.BuildTime,
    },
    // System resources
    resources: {
      cpus: info.NCPU,
      memoryTotal: formatBytes(info.MemTotal),
      memoryTotalBytes: info.MemTotal,
    },
    // Container stats
    containers: {
      total: info.Containers,
      running: info.ContainersRunning,
      paused: info.ContainersPaused,
      stopped: info.ContainersStopped,
    },
    // Image stats
    images: info.Images,
    // Storage
    storage: {
      driver: info.Driver,
      driverStatus: info.DriverStatus,
      rootDir: info.DockerRootDir,
    },
    // System info
    system: {
      name: info.Name,
      operatingSystem: info.OperatingSystem,
      osType: info.OSType,
      osVersion: info.OSVersion,
      architecture: info.Architecture,
      serverVersion: info.ServerVersion,
    },
    // Plugins
    plugins: {
      volume: info.Plugins?.Volume,
      network: info.Plugins?.Network,
      log: info.Plugins?.Log,
    },
    // Swarm
    swarm: info.Swarm
      ? {
          nodeId: info.Swarm.NodeID,
          nodeAddr: info.Swarm.NodeAddr,
          localNodeState: info.Swarm.LocalNodeState,
          controlAvailable: info.Swarm.ControlAvailable,
          nodes: info.Swarm.Nodes,
          managers: info.Swarm.Managers,
        }
      : null,
  };
}

async function prune(params: {
  containers?: boolean;
  images?: boolean;
  networks?: boolean;
  volumes?: boolean;
  allImages?: boolean;
}): Promise<object> {
  const results: Record<string, object> = {};
  let totalSpaceReclaimed = 0;

  // Prune containers (default: true)
  if (params.containers !== false) {
    const containerPrune = await docker.pruneContainers();
    results.containers = {
      deleted: containerPrune.ContainersDeleted || [],
      count: containerPrune.ContainersDeleted?.length || 0,
      spaceReclaimed: formatBytes(containerPrune.SpaceReclaimed || 0),
    };
    totalSpaceReclaimed += containerPrune.SpaceReclaimed || 0;
  }

  // Prune images (default: false)
  if (params.images) {
    const imagePrune = await docker.pruneImages({
      filters: params.allImages ? undefined : { dangling: ["true"] },
    });
    results.images = {
      deleted: imagePrune.ImagesDeleted || [],
      count: imagePrune.ImagesDeleted?.length || 0,
      spaceReclaimed: formatBytes(imagePrune.SpaceReclaimed || 0),
    };
    totalSpaceReclaimed += imagePrune.SpaceReclaimed || 0;
  }

  // Prune networks (default: true)
  if (params.networks !== false) {
    const networkPrune = await docker.pruneNetworks();
    results.networks = {
      deleted: networkPrune.NetworksDeleted || [],
      count: networkPrune.NetworksDeleted?.length || 0,
    };
  }

  // Prune volumes (default: false - dangerous!)
  if (params.volumes) {
    const volumePrune = await docker.pruneVolumes();
    results.volumes = {
      deleted: volumePrune.VolumesDeleted || [],
      count: volumePrune.VolumesDeleted?.length || 0,
      spaceReclaimed: formatBytes(volumePrune.SpaceReclaimed || 0),
    };
    totalSpaceReclaimed += volumePrune.SpaceReclaimed || 0;
  }

  return {
    pruned: true,
    results,
    totalSpaceReclaimed: formatBytes(totalSpaceReclaimed),
    totalSpaceReclaimedBytes: totalSpaceReclaimed,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "docker-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: object;

    switch (name) {
      case "list_containers":
        result = await listContainers(args as Parameters<typeof listContainers>[0]);
        break;
      case "get_container":
        result = await getContainer(args as Parameters<typeof getContainer>[0]);
        break;
      case "create_container":
        result = await createContainer(args as Parameters<typeof createContainer>[0]);
        break;
      case "start_container":
        result = await startContainer(args as Parameters<typeof startContainer>[0]);
        break;
      case "stop_container":
        result = await stopContainer(args as Parameters<typeof stopContainer>[0]);
        break;
      case "restart_container":
        result = await restartContainer(args as Parameters<typeof restartContainer>[0]);
        break;
      case "remove_container":
        result = await removeContainer(args as Parameters<typeof removeContainer>[0]);
        break;
      case "get_container_logs":
        result = await getContainerLogs(args as Parameters<typeof getContainerLogs>[0]);
        break;
      case "exec_command":
        result = await execCommand(args as Parameters<typeof execCommand>[0]);
        break;
      case "list_images":
        result = await listImages(args as Parameters<typeof listImages>[0]);
        break;
      case "pull_image":
        result = await pullImage(args as Parameters<typeof pullImage>[0]);
        break;
      case "remove_image":
        result = await removeImage(args as Parameters<typeof removeImage>[0]);
        break;
      case "tag_image":
        result = await tagImage(args as Parameters<typeof tagImage>[0]);
        break;
      case "build_image":
        result = await buildImage(args as Parameters<typeof buildImage>[0]);
        break;
      case "list_volumes":
        result = await listVolumes(args as Parameters<typeof listVolumes>[0]);
        break;
      case "create_volume":
        result = await createVolume(args as Parameters<typeof createVolume>[0]);
        break;
      case "remove_volume":
        result = await removeVolume(args as Parameters<typeof removeVolume>[0]);
        break;
      case "list_networks":
        result = await listNetworks(args as Parameters<typeof listNetworks>[0]);
        break;
      case "create_network":
        result = await createNetwork(args as Parameters<typeof createNetwork>[0]);
        break;
      case "connect_network":
        result = await connectNetwork(args as Parameters<typeof connectNetwork>[0]);
        break;
      case "get_system_info":
        result = await getSystemInfo();
        break;
      case "prune":
        result = await prune(args as Parameters<typeof prune>[0]);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: errorMessage, tool: name }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Docker MCP Server running on stdio");
  console.error(`Docker host: ${process.env.DOCKER_HOST || "(default socket)"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
