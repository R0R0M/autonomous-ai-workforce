/** Smoke test: verify the Agent SDK backend works and bills the subscription. */
import "dotenv/config";
process.env.AGENT_BACKEND = "sdk";

import { runSdkAgent } from "../src/lib/agents/sdk";

async function main() {
  const { text, usage } = await runSdkAgent({
    prompt: "Reply with exactly the word: ok",
    systemPrompt: "You are a test probe. Follow the instruction literally.",
    mode: "none",
    maxTurns: 1,
  });
  console.log("RESULT TEXT:", JSON.stringify(text));
  console.log("USAGE:", usage);
  console.log(text.trim().toLowerCase().includes("ok") ? "SMOKE TEST PASSED" : "SMOKE TEST FAILED");
}

main().catch((err) => {
  console.error("SMOKE TEST ERROR:", err);
  process.exit(1);
});
