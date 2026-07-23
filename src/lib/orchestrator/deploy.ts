/** Trigger a deploy hook (Vercel / Railway / Render style POST webhook). */
export async function triggerDeployHook(url: string): Promise<void> {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Deploy hook returned ${res.status} ${res.statusText}`);
  }
}

export interface HealthCheckResult {
  healthy: boolean;
  detail: string;
}

/**
 * Poll a production health-check URL until it responds 2xx, or attempts run out.
 * Deployments take time to roll out, so we wait between attempts.
 */
export async function verifyHealth(
  url: string,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<HealthCheckResult> {
  const attempts = opts.attempts ?? 10;
  const delayMs = opts.delayMs ?? 30_000;

  let lastDetail = "no attempts made";
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      if (res.ok) {
        return { healthy: true, detail: `HTTP ${res.status} on attempt ${i + 1}` };
      }
      lastDetail = `HTTP ${res.status}`;
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : String(err);
    }
  }
  return { healthy: false, detail: `unhealthy after ${attempts} attempts: ${lastDetail}` };
}
