/**
 * MASOM Assistant — AI provider capability test.
 *
 * Verifies that the configured OpenAI-compatible provider (OpenRouter by
 * default) can actually do the four things the assistant depends on:
 *
 *   A. Return normal assistant text.
 *   B. Decide to call a tool when the question needs one.
 *   C. Produce STRUCTURED, schema-shaped tool arguments.
 *   D. Turn a tool result into a final natural-language answer.
 *
 * This is a developer tool, run by hand from a terminal. It is deliberately
 * NOT an HTTP endpoint: there is no debug route to forget about in production.
 * It uses a throwaway `getTestEvent` tool, never the real MASOM tools, and it
 * never touches the database.
 *
 * The key is read from the environment and never printed — only its presence
 * and length are reported.
 *
 * Usage:
 *   node --env-file=.env.local scripts/ai-capability-test.mjs
 */

const DEFAULTS = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "deepseek/deepseek-v4-flash-0731:free",
};

const apiKey = (process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? "").trim();
const baseUrl = (process.env.AI_BASE_URL ?? DEFAULTS.baseUrl).trim().replace(/\/+$/, "");
const model = (process.env.AI_MODEL ?? DEFAULTS.model).trim();
const provider = (process.env.AI_PROVIDER ?? "openrouter").trim();

if (!apiKey) {
  console.error(
    "No API key found.\n" +
      "Add OPENROUTER_API_KEY=<your key> to .env.local, then re-run:\n" +
      "  node --env-file=.env.local scripts/ai-capability-test.mjs",
  );
  process.exit(1);
}

console.log("Provider :", provider);
console.log("Base URL :", baseUrl);
console.log("Model    :", model);
// Never print the key itself — presence and length only.
console.log("API key  :", `present (${apiKey.length} chars)`);

/** The throwaway tool. Deterministic, in-memory, no database, no network. */
const TEST_EVENTS = {
  "wiladat imam hasan askari": { hijri: "10 Rabi-us-Saani", gregorian: "2026-09-21" },
  "eid ul fitr": { hijri: "1 Shawwal", gregorian: "2026-03-20" },
};

function getTestEvent({ name }) {
  if (typeof name !== "string" || name.trim().length < 2) {
    return { ok: false, error: "name must be a non-empty string" };
  }
  const key = name.trim().toLowerCase();
  const match = Object.keys(TEST_EVENTS).find(
    (candidate) => candidate.includes(key) || key.includes(candidate),
  );
  if (!match) return { ok: false, error: `No test event matching "${name}".` };
  return { ok: true, name: match, ...TEST_EVENTS[match] };
}

const TEST_TOOL = {
  type: "function",
  function: {
    name: "getTestEvent",
    description:
      "Look up a test Islamic event by name and return its Hijri and Gregorian date. " +
      "Use this for any question about an event date — never answer from memory.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The event name as the user said it." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
};

async function chat({ messages, tools }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://www.masom.com",
        "X-Title": "MASOM Assistant",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 512,
        temperature: 0.2,
        ...(tools ? { tools, tool_choice: "auto" } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Status only — the body may echo request content back.
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload?.error) throw new Error(`provider error: ${payload.error.code ?? "unknown"}`);

    const message = payload?.choices?.[0]?.message;
    if (!message) throw new Error("malformed response: no choices[0].message");

    return { message, finishReason: payload.choices[0].finish_reason, usage: payload.usage };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
function record(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log(`\n${pass ? "PASS" : "FAIL"} — ${label}`);
  if (detail) console.log("  " + String(detail).replace(/\n/g, "\n  "));
}

const SYSTEM =
  "You are a test harness assistant. When a tool is available for a question, " +
  "call the tool instead of answering from memory.";

async function main() {
  // ---- A. Normal text -----------------------------------------------------
  try {
    const { message } = await chat({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: "Reply with exactly: HELLO MASOM" },
      ],
    });
    const text = (message.content ?? "").trim();
    record("A. Normal chat completion", text.length > 0, text.slice(0, 200));
  } catch (error) {
    record("A. Normal chat completion", false, error.message);
  }

  // ---- B + C + D. Tool calling round-trip ---------------------------------
  try {
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: "Wiladat Imam Hasan Askari kab hai?" },
    ];

    const first = await chat({ messages, tools: [TEST_TOOL] });
    const toolCalls = first.message.tool_calls ?? [];

    record(
      "B. Native tool calling",
      toolCalls.length > 0,
      toolCalls.length > 0
        ? `finish_reason=${first.finishReason}, tool=${toolCalls[0].function?.name}`
        : `model answered without a tool: ${(first.message.content ?? "").slice(0, 160)}`,
    );

    if (toolCalls.length === 0) {
      summarize();
      return;
    }

    const call = toolCalls[0];
    let args = null;
    let argsOk = false;
    try {
      args = JSON.parse(call.function.arguments || "{}");
      argsOk =
        call.function.name === "getTestEvent" &&
        typeof args.name === "string" &&
        args.name.trim().length >= 2;
    } catch {
      argsOk = false;
    }
    record("C. Structured tool arguments", argsOk, `arguments=${call.function.arguments}`);

    if (!argsOk) {
      summarize();
      return;
    }

    // Execute the tool locally, exactly as the server would.
    const toolResult = getTestEvent(args);

    messages.push({
      role: "assistant",
      content: first.message.content ?? "",
      tool_calls: toolCalls,
    });
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(toolResult),
    });

    const second = await chat({ messages, tools: [TEST_TOOL] });
    const finalText = (second.message.content ?? "").trim();
    // A real grounded answer must repeat the date the tool returned.
    const expectedDate = toolResult.ok ? toolResult.gregorian : null;
    const grounded =
      finalText.length > 0 &&
      (finalText.includes("Rabi") ||
        (expectedDate !== null && finalText.includes(expectedDate)));

    record(
      "D. Tool result → final answer",
      grounded,
      finalText.slice(0, 300) || "(empty reply)",
    );
  } catch (error) {
    record("B/C/D. Tool-calling round trip", false, error.message);
  }

  summarize();
}

function summarize() {
  const failed = results.filter((result) => !result.pass);
  console.log("\n" + "=".repeat(60));
  console.log(`${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("Failed: " + failed.map((result) => result.label).join(", "));
    process.exitCode = 1;
  }
}

await main();
