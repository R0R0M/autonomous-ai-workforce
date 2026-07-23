import { db } from "@/lib/db";
import type { AgentName } from "@prisma/client";

export async function addMemory(
  repositoryId: string,
  agent: AgentName,
  kind: string,
  content: string,
): Promise<void> {
  await db.memoryEntry.create({ data: { repositoryId, agent, kind, content } });
}

export async function getMemories(
  repositoryId: string,
  opts?: { agent?: AgentName; kinds?: string[]; limit?: number },
) {
  return db.memoryEntry.findMany({
    where: {
      repositoryId,
      ...(opts?.agent ? { agent: opts.agent } : {}),
      ...(opts?.kinds ? { kind: { in: opts.kinds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 30,
  });
}

export function formatMemories(
  memories: { kind: string; content: string; createdAt: Date }[],
): string {
  if (memories.length === 0) return "(no prior memory for this repository)";
  return memories
    .map((m) => `- [${m.kind}] (${m.createdAt.toISOString().slice(0, 10)}) ${m.content}`)
    .join("\n");
}
