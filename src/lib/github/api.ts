import { Octokit } from "@octokit/rest";

export function githubClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function createPullRequest(
  token: string,
  params: {
    owner: string;
    repo: string;
    head: string;
    base: string;
    title: string;
    body: string;
  },
): Promise<{ number: number; url: string }> {
  const gh = githubClient(token);
  const { data } = await gh.pulls.create(params);
  return { number: data.number, url: data.html_url };
}

export async function mergePullRequest(
  token: string,
  params: { owner: string; repo: string; pullNumber: number },
): Promise<{ merged: boolean; sha: string | null }> {
  const gh = githubClient(token);
  const { data } = await gh.pulls.merge({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    merge_method: "squash",
  });
  return { merged: data.merged, sha: data.sha ?? null };
}

export async function createIssue(
  token: string,
  params: { owner: string; repo: string; title: string; body: string; labels?: string[] },
): Promise<{ number: number; url: string }> {
  const gh = githubClient(token);
  const { data } = await gh.issues.create(params);
  return { number: data.number, url: data.html_url };
}

/** Merge a branch directly into the base branch via the GitHub API (DIRECT_MERGE mode). */
export async function mergeBranch(
  token: string,
  params: { owner: string; repo: string; base: string; head: string; message: string },
): Promise<{ sha: string | null }> {
  const gh = githubClient(token);
  const { data } = await gh.repos.merge({
    owner: params.owner,
    repo: params.repo,
    base: params.base,
    head: params.head,
    commit_message: params.message,
  });
  return { sha: data?.sha ?? null };
}
