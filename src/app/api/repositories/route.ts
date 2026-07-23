import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { githubClient } from "@/lib/github/api";

const CreateRepoSchema = z.object({
  url: z.string().min(3), // "owner/name" or a full GitHub URL
  githubToken: z.string().min(10),
  schedule: z.enum(["CONTINUOUS", "NIGHTLY", "MANUAL"]).default("CONTINUOUS"),
  mergeMode: z.enum(["PULL_REQUEST", "DIRECT_MERGE"]).default("PULL_REQUEST"),
  autoMergePr: z.boolean().default(true),
  requireHumanApproval: z.boolean().default(false),
  deployHookUrl: z.string().url().optional().or(z.literal("")),
  healthCheckUrl: z.string().url().optional().or(z.literal("")),
});

function parseOwnerName(input: string): { owner: string; name: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], name: parts[1] };
}

export async function GET() {
  const userId = await requireUserId();
  const repos = await db.repository.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, owner: true, name: true, status: true, schedule: true,
      mergeMode: true, lastCycleAt: true, createdAt: true,
    },
  });
  return NextResponse.json(repos);
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  const body = CreateRepoSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const parsed = parseOwnerName(body.data.url);
  if (!parsed) {
    return NextResponse.json(
      { error: "Repository must be 'owner/name' or a GitHub URL" },
      { status: 400 },
    );
  }

  // Validate the token and fetch the default branch.
  let defaultBranch: string;
  try {
    const gh = githubClient(body.data.githubToken);
    const { data } = await gh.repos.get({ owner: parsed.owner, repo: parsed.name });
    defaultBranch = data.default_branch;
  } catch {
    return NextResponse.json(
      { error: "Could not access that repository with the provided token" },
      { status: 400 },
    );
  }

  const repo = await db.repository.create({
    data: {
      userId,
      owner: parsed.owner,
      name: parsed.name,
      defaultBranch,
      githubTokenEnc: encrypt(body.data.githubToken),
      schedule: body.data.schedule,
      mergeMode: body.data.mergeMode,
      autoMergePr: body.data.autoMergePr,
      requireHumanApproval: body.data.requireHumanApproval,
      deployHookUrl: body.data.deployHookUrl || null,
      healthCheckUrl: body.data.healthCheckUrl || null,
    },
  });
  return NextResponse.json({ id: repo.id }, { status: 201 });
}
