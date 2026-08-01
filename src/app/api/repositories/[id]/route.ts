import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

const UpdateSchema = z.object({
  schedule: z.enum(["CONTINUOUS", "NIGHTLY", "MANUAL"]).optional(),
  mergeMode: z.enum(["PULL_REQUEST", "DIRECT_MERGE"]).optional(),
  autoMergePr: z.boolean().optional(),
  requireHumanApproval: z.boolean().optional(),
  requireIdeaApproval: z.boolean().optional(),
  model: z.enum(["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"]).optional(),
  deployHookUrl: z.string().url().nullable().or(z.literal("")).optional(),
  healthCheckUrl: z.string().url().nullable().or(z.literal("")).optional(),
  githubToken: z.string().min(10).optional(),
});

async function ownedRepo(id: string) {
  const userId = await requireUserId();
  const repo = await db.repository.findUnique({ where: { id } });
  if (!repo || repo.userId !== userId) return null;
  return repo;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await ownedRepo(id);
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = UpdateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const { githubToken, deployHookUrl, healthCheckUrl, ...rest } = body.data;

  await db.repository.update({
    where: { id },
    data: {
      ...rest,
      ...(githubToken ? { githubTokenEnc: encrypt(githubToken) } : {}),
      ...(deployHookUrl !== undefined ? { deployHookUrl: deployHookUrl || null } : {}),
      ...(healthCheckUrl !== undefined ? { healthCheckUrl: healthCheckUrl || null } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await ownedRepo(id);
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.repository.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
