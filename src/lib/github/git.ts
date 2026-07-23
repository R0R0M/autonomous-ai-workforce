import fs from "fs";
import path from "path";
import { simpleGit, SimpleGit } from "simple-git";
import { config } from "@/lib/config";

export interface RepoRef {
  id: string;
  owner: string;
  name: string;
  defaultBranch: string;
}

export function workspacePath(repoId: string): string {
  return path.join(config.workspacesDir, repoId);
}

function authedRemote(repo: RepoRef, token: string): string {
  return `https://x-access-token:${token}@github.com/${repo.owner}/${repo.name}.git`;
}

function cleanRemote(repo: RepoRef): string {
  return `https://github.com/${repo.owner}/${repo.name}.git`;
}

function git(dir: string): SimpleGit {
  return simpleGit({ baseDir: dir });
}

/**
 * Ensure a clean, up-to-date clone of the repository's default branch.
 * Discards any local changes left over from a failed cycle.
 *
 * Security: the stored `origin` remote is credential-free. The token is used
 * only transiently for clone/fetch/push commands issued by the orchestrator,
 * so agents working in the checkout can never push (nothing to push with).
 */
export async function ensureWorkspace(repo: RepoRef, token: string): Promise<string> {
  const dir = workspacePath(repo.id);

  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(dir, { recursive: true });
    await simpleGit().clone(authedRemote(repo, token), dir);
  }

  const g = git(dir);
  // Keep the persisted remote credential-free; fetch with an explicit
  // authenticated URL that updates the origin/* tracking refs.
  await g.remote(["set-url", "origin", cleanRemote(repo)]);
  await g.raw([
    "fetch",
    authedRemote(repo, token),
    `+refs/heads/*:refs/remotes/origin/*`,
    "--prune",
  ]);
  // Discard anything left by an interrupted cycle BEFORE switching branches —
  // a dirty tree makes plain `git checkout` refuse and fail the whole cycle.
  await g.reset(["--hard"]);
  await g.clean("f", ["-d"]);
  await g.raw(["checkout", "-f", repo.defaultBranch]);
  await g.reset(["--hard", `origin/${repo.defaultBranch}`]);
  await g.clean("f", ["-d"]);
  return dir;
}

export async function createBranch(dir: string, branchName: string): Promise<void> {
  await git(dir).checkoutLocalBranch(branchName);
}

export async function checkoutBranch(dir: string, branchName: string): Promise<void> {
  await git(dir).checkout(branchName);
}

/** Stage everything and commit. Returns the commit SHA, or null if nothing changed. */
export async function commitAll(dir: string, message: string): Promise<string | null> {
  const g = git(dir);
  await g.add(["-A"]);
  const status = await g.status();
  if (status.staged.length === 0 && status.files.length === 0) return null;
  await g.commit(message, undefined, {
    "--author": "Autonomous AI Workforce <workforce@autonomous.dev>",
  });
  return (await g.revparse(["HEAD"])).trim();
}

export async function push(
  dir: string,
  branchName: string,
  repo: RepoRef,
  token: string,
): Promise<void> {
  // Credentials are injected only for this one command (see ensureWorkspace).
  await git(dir).raw([
    "push",
    "--force",
    authedRemote(repo, token),
    `${branchName}:refs/heads/${branchName}`,
  ]);
}

/** Full diff of the working branch against the default branch. */
export async function diffAgainst(dir: string, baseBranch: string): Promise<string> {
  const g = git(dir);
  await g.add(["-A"]); // include untracked files in the diff
  return g.diff(["--cached", `origin/${baseBranch}`]);
}

/** List of files changed vs the default branch. */
export async function changedFiles(dir: string, baseBranch: string): Promise<string[]> {
  const g = git(dir);
  await g.add(["-A"]);
  const out = await g.diff(["--cached", "--name-only", `origin/${baseBranch}`]);
  return out.split("\n").filter(Boolean);
}

/** Diff of a single commit (what that commit alone changed). */
export async function diffOfCommit(dir: string, sha: string): Promise<string> {
  return git(dir).raw(["show", "--format=", sha]);
}

export async function diffStatOfCommit(dir: string, sha: string): Promise<string> {
  return git(dir).raw(["show", "--stat", "--format=", sha]);
}

/**
 * Roll back a merge on the default branch: revert the merge commit and push.
 * Returns the revert commit SHA.
 */
export async function revertMergeOnDefault(
  repo: RepoRef,
  token: string,
  mergeSha: string,
): Promise<string> {
  const dir = await ensureWorkspace(repo, token);
  const g = git(dir);
  try {
    await g.raw(["revert", "-m", "1", mergeSha, "--no-edit"]);
  } catch {
    // Not a merge commit (direct/squash merge) — plain revert.
    await g.raw(["revert", mergeSha, "--no-edit"]);
  }
  await g.raw([
    "push",
    authedRemote(repo, token),
    `${repo.defaultBranch}:refs/heads/${repo.defaultBranch}`,
  ]);
  return (await g.revparse(["HEAD"])).trim();
}

export async function headSha(dir: string): Promise<string> {
  return (await git(dir).revparse(["HEAD"])).trim();
}
