import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";

const execFileAsync = promisify(execFile);

const MAX_TOOL_OUTPUT = 30_000;
const BASH_TIMEOUT_MS = 5 * 60 * 1000;

/** Resolve a model-supplied path and guarantee it stays inside the workspace. */
export function resolveInWorkspace(root: string, relPath: string): string {
  const resolved = path.resolve(root, relPath);
  const normalizedRoot = path.resolve(root);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error(`Path escapes the workspace: ${relPath}`);
  }
  return resolved;
}

const DENIED_COMMAND_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /git\s+push/, reason: "git push is handled by the orchestrator" },
  { pattern: /git\s+remote/, reason: "remote configuration is handled by the orchestrator" },
  { pattern: /rm\s+(-[a-zA-Z]*\s+)*(\/|~)(\s|$)/, reason: "destructive delete outside workspace" },
  { pattern: /\bsudo\b/, reason: "privilege escalation is not allowed" },
  { pattern: /\b(shutdown|reboot|halt|poweroff)\b/, reason: "system control is not allowed" },
  { pattern: /\bmkfs\b/, reason: "filesystem operations are not allowed" },
  { pattern: /:\(\)\s*\{.*\}\s*;\s*:/, reason: "fork bomb" },
  { pattern: /\b(curl|wget)\b[^|;]*\|\s*(ba)?sh/, reason: "piping remote scripts to a shell is not allowed" },
  { pattern: /\/etc\/(passwd|shadow)/, reason: "system file access is not allowed" },
  { pattern: /\bprintenv\b|\benv\s*$|\becho\s+\$ANTHROPIC|\becho\s+\$AUTH/, reason: "environment inspection is not allowed" },
];

export function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  for (const { pattern, reason } of DENIED_COMMAND_PATTERNS) {
    if (pattern.test(command)) return { allowed: false, reason };
  }
  return { allowed: true };
}

function truncate(text: string, limit = MAX_TOOL_OUTPUT): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n... [truncated ${text.length - limit} chars]`;
}

/** Minimal env for agent-run commands — no API keys or app secrets leak in. */
function scrubbedEnv(): Record<string, string | undefined> {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    TERM: "dumb",
    CI: "true",
    NO_COLOR: "1",
  };
}

export async function runBash(
  root: string,
  command: string,
): Promise<{ output: string; exitCode: number }> {
  const check = isCommandAllowed(command);
  if (!check.allowed) {
    return { output: `Command blocked by safety policy: ${check.reason}`, exitCode: 126 };
  }
  try {
    const { stdout, stderr } = await execFileAsync("/bin/bash", ["-lc", command], {
      cwd: root,
      timeout: BASH_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
      env: scrubbedEnv() as NodeJS.ProcessEnv,
    });
    return { output: truncate([stdout, stderr].filter(Boolean).join("\n")) || "(no output)", exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean; message?: string };
    const body = [e.stdout, e.stderr].filter(Boolean).join("\n") || e.message || "command failed";
    const note = e.killed ? "\n[command timed out after 5 minutes]" : "";
    return { output: truncate(body + note), exitCode: typeof e.code === "number" ? e.code : 1 };
  }
}

function listFilesRecursive(root: string, dir: string, depth: number, acc: string[], maxEntries: number) {
  if (acc.length >= maxEntries || depth < 0) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (acc.length >= maxEntries) return;
    if ([".git", "node_modules", ".next", "dist", "build", "coverage", ".turbo"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    if (entry.isDirectory()) {
      acc.push(rel + "/");
      listFilesRecursive(root, full, depth - 1, acc, maxEntries);
    } else {
      acc.push(rel);
    }
  }
}

/** Callback fired for every tool action — powers the live activity feed. */
export type ToolEventSink = (event: {
  tool: string;
  summary: string;
  detail?: string;
}) => Promise<void> | void;

/**
 * Build the sandboxed tool set for an agent working in `root`.
 * `allowWrite: false` gives the Tester read+run access without file mutation tools.
 * `onEvent` receives every tool action as it happens (best-effort, never throws).
 */
export function makeWorkspaceTools(
  root: string,
  opts: { allowWrite: boolean; onEvent?: ToolEventSink },
) {
  const emit = async (event: { tool: string; summary: string; detail?: string }) => {
    try {
      await opts.onEvent?.(event);
    } catch {
      // The feed must never break the agent loop.
    }
  };

  const bash = betaZodTool({
    name: "bash",
    description:
      "Run a shell command in the repository workspace (cwd = repo root). Use for installing dependencies, running tests/linters/builds, and inspecting the project. 5 minute timeout. git push and other remote-state commands are blocked.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to run"),
    }),
    run: async ({ command }) => {
      const { output, exitCode } = await runBash(root, command);
      await emit({
        tool: "bash",
        summary: `$ ${command.slice(0, 200)}${exitCode !== 0 ? ` (exit ${exitCode})` : ""}`,
        detail: output.slice(0, 8000),
      });
      return `exit code: ${exitCode}\n${output}`;
    },
  });

  const readFile = betaZodTool({
    name: "read_file",
    description: "Read a file from the workspace. Path is relative to the repo root.",
    inputSchema: z.object({
      path: z.string(),
    }),
    run: async ({ path: p }) => {
      const full = resolveInWorkspace(root, p);
      if (!fs.existsSync(full)) return `File not found: ${p}`;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) return `${p} is a directory — use list_files`;
      if (stat.size > 512 * 1024) return `File too large to read (${stat.size} bytes): ${p}`;
      await emit({ tool: "read_file", summary: `read ${p}` });
      return truncate(fs.readFileSync(full, "utf8"));
    },
  });

  const listFiles = betaZodTool({
    name: "list_files",
    description:
      "List files in the workspace (recursive, ignores node_modules/.git/build dirs). Optionally pass a subdirectory.",
    inputSchema: z.object({
      dir: z.string().describe("Subdirectory relative to repo root; '.' for the root"),
    }),
    run: async ({ dir }) => {
      const full = resolveInWorkspace(root, dir || ".");
      const acc: string[] = [];
      listFilesRecursive(root, full, 6, acc, 800);
      return acc.length ? acc.join("\n") : "(empty)";
    },
  });

  const writeFile = betaZodTool({
    name: "write_file",
    description:
      "Create or overwrite a file in the workspace with the given content. Parent directories are created automatically. Path is relative to the repo root.",
    inputSchema: z.object({
      path: z.string(),
      content: z.string(),
    }),
    run: async ({ path: p, content }) => {
      const full = resolveInWorkspace(root, p);
      const { simpleDiff, newFileDiff } = await import("./diff");
      const existed = fs.existsSync(full) && fs.statSync(full).isFile();
      const diff = existed
        ? simpleDiff(fs.readFileSync(full, "utf8"), content)
        : newFileDiff(content);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, "utf8");
      await emit({
        tool: "write_file",
        summary: `${existed ? "edited" : "created"} ${p} (+${diff.added}/-${diff.removed})`,
        detail: diff.text.slice(0, 12_000),
      });
      return `Wrote ${Buffer.byteLength(content)} bytes to ${p}`;
    },
  });

  return opts.allowWrite ? [bash, readFile, listFiles, writeFile] : [bash, readFile, listFiles];
}
