import Dockerode from "dockerode";

const docker = new Dockerode();

export interface SandboxOptions {
  /** Docker image to use (e.g., "node:22-alpine") */
  image: string;
  /** Command to execute */
  command: string[];
  /** Timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Memory limit in bytes (default: 2GB) */
  memoryBytes?: number;
  /** CPU core count limit (default: 4) */
  cpuCount?: number;
  /** User to run as (default: "1000:1000") */
  user?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
}

const DEFAULT_MEMORY = 2 * 1024 * 1024 * 1024; // 2GB
const DEFAULT_CPU = 4;
const DEFAULT_TIMEOUT = 60_000;

/**
 * Execute code inside an isolated Docker container with security constraints:
 * - No network access (NetworkMode: "none")
 * - Read-only filesystem except /tmp
 * - Memory limit (default 2GB)
 * - CPU limit (default 4 cores)
 * - Execution timeout (default 60s)
 * - Non-root user (uid 1000)
 */
export async function execute(options: SandboxOptions): Promise<SandboxResult> {
  const {
    image,
    command,
    timeoutMs = DEFAULT_TIMEOUT,
    memoryBytes = DEFAULT_MEMORY,
    cpuCount = DEFAULT_CPU,
    user = "1000:1000",
  } = options;

  const start = Date.now();
  let timedOut = false;

  // Ensure image is available
  try {
    await docker.getImage(image).inspect();
  } catch {
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err2: Error | null) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  }

  const container = await docker.createContainer({
    Image: image,
    Cmd: command,
    User: user,
    NetworkDisabled: true,
    HostConfig: {
      NetworkMode: "none",
      ReadonlyRootfs: true,
      Tmpfs: { "/tmp": "rw,noexec,nosuid,size=256m" },
      Memory: memoryBytes,
      NanoCpus: cpuCount * 1e9,
      AutoRemove: false,
    },
    AttachStdout: true,
    AttachStderr: true,
  });

  try {
    // Attach to streams before starting
    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    // Demux stdout/stderr
    const stdoutPassthrough = new (await import("node:stream")).PassThrough();
    const stderrPassthrough = new (await import("node:stream")).PassThrough();

    docker.modem.demuxStream(stream, stdoutPassthrough, stderrPassthrough);

    stdoutPassthrough.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    stderrPassthrough.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    await container.start();

    // Wait for exit or timeout
    const waitPromise = container.wait();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const result = await Promise.race([waitPromise, timeoutPromise]);

    if (result === null) {
      // Timeout — kill the container
      timedOut = true;
      await container.kill().catch(() => {});
      // Wait for container to stop after kill
      await container.wait().catch(() => {});
    }

    const exitCode = timedOut
      ? 137
      : (result as { StatusCode: number })?.StatusCode ?? 1;

    // Small delay to ensure streams are flushed
    await new Promise((r) => setTimeout(r, 100));

    return {
      stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
      stderr: Buffer.concat(stderrChunks).toString("utf-8"),
      exitCode,
      timedOut,
      durationMs: Date.now() - start,
    };
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}
