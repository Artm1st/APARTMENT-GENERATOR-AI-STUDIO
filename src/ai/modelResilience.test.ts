import test from "node:test";
import assert from "node:assert/strict";
import {
  GeminiTemporarilyUnavailableError,
  isTransientGeminiError,
  runWithGeminiFallback,
} from "./modelResilience";

test("recognizes Gemini 503 high-demand errors as transient", () => {
  assert.equal(
    isTransientGeminiError(new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}')),
    true
  );
});

test("falls back to the next model after transient failures", async () => {
  const attempts: string[] = [];
  const result = await runWithGeminiFallback(
    async (model) => {
      attempts.push(model);
      if (model === "primary") {
        const error = new Error("503 UNAVAILABLE high demand");
        (error as any).status = 503;
        throw error;
      }
      return `ok:${model}`;
    },
    { models: ["primary", "fallback"], retriesPerModel: 1, baseDelayMs: 0 }
  );

  assert.equal(result.model, "fallback");
  assert.equal(result.value, "ok:fallback");
  assert.deepEqual(attempts, ["primary", "fallback"]);
});

test("throws a friendly availability error when every model is unavailable", async () => {
  await assert.rejects(
    () => runWithGeminiFallback(
      async () => {
        const error = new Error("503 UNAVAILABLE");
        (error as any).status = 503;
        throw error;
      },
      { models: ["a", "b"], retriesPerModel: 1, baseDelayMs: 0 }
    ),
    GeminiTemporarilyUnavailableError
  );
});
