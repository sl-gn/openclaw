#!/usr/bin/env -S bun run
/**
 * Debug script: send a local video file to the agent via gateway chat.send.
 * Uses openrouter/google/gemini-3-flash-preview (configure model override in session if needed).
 *
 * Prerequisites:
 * - Gateway running: pnpm gateway (or openclaw gateway run)
 * - openrouter API key in config
 * - Optional: set model override for main session to openrouter/google/gemini-3-flash-preview
 *
 * Usage:
 *   bun scripts/debug-video-openrouter.ts [video-path]
 *   pnpm exec node --import tsx scripts/debug-video-openrouter.ts [video-path]
 *
 * Default video path: /Users/kuaiyin/Desktop/output.mp4
 *
 * Set model override for main session (optional):
 *   openclaw config set session.main.modelOverride openrouter/google/gemini-3-flash-preview
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createGatewayWsClient, resolveGatewayUrl } from "./dev/gateway-ws-client.ts";

const VIDEO_PATH = process.argv[2] ?? "/Users/kuaiyin/Desktop/output.mp4";
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;

async function main() {
  const resolvedPath = path.resolve(VIDEO_PATH);
  const stat = await fs.stat(resolvedPath).catch((e) => {
    console.error(`Cannot read video: ${resolvedPath}`);
    console.error(e);
    process.exit(1);
  });
  if (!stat.isFile()) {
    console.error(`Not a file: ${resolvedPath}`);
    process.exit(1);
  }

  const buf = await fs.readFile(resolvedPath);
  const base64 = buf.toString("base64");
  const sizeMb = (buf.byteLength / (1024 * 1024)).toFixed(2);
  console.log(`Read ${resolvedPath}: ${sizeMb} MB (${base64.length} base64 chars)`);

  if (buf.byteLength > 50 * 1024 * 1024) {
    console.error("Video exceeds 50 MB limit");
    process.exit(1);
  }

  const url = resolveGatewayUrl(GATEWAY_URL);
  const { request, waitOpen, close } = createGatewayWsClient({
    url: url.toString(),
    onEvent: (evt) => {
      if (evt.event === "chat.delta" && evt.payload) {
        const p = evt.payload as { delta?: string };
        if (typeof p.delta === "string") {
          process.stdout.write(p.delta);
        }
      }
      if (evt.event === "chat.final" && evt.payload) {
        const p = evt.payload as { text?: string };
        if (typeof p.text === "string") {
          console.log("\n--- final ---");
          console.log(p.text);
        }
      }
    },
  });

  await waitOpen();

  const connectParams: Record<string, unknown> = {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "debug-video-script",
      displayName: "debug-video-openrouter",
      version: "dev",
      platform: "dev",
      mode: "ui",
      instanceId: "debug-video",
    },
    locale: "en-US",
    userAgent: "debug-video-openrouter",
    role: "operator",
    scopes: ["operator.read", "operator.write", "operator.admin"],
    caps: [],
  };
  if (GATEWAY_TOKEN) {
    connectParams.auth = { token: GATEWAY_TOKEN };
  }

  const connectRes = await request("connect", connectParams);
  if (!connectRes.ok) {
    console.error("connect failed:", connectRes.error);
    process.exit(2);
  }

  const runId = `debug-video-${Date.now()}`;
  console.log(`\nSending chat.send with video attachment (runId=${runId})...`);
  console.log("Session: main. Ensure model is openrouter/google/gemini-3-flash-preview.\n");

  const sendRes = await request(
    "chat.send",
    {
      sessionKey: "main",
      message: "Describe this video briefly.",
      idempotencyKey: runId,
      attachments: [
        {
          type: "file",
          mimeType: "video/mp4",
          content: base64,
        },
      ],
    },
    120_000,
  );

  if (!sendRes.ok) {
    console.error("chat.send failed:", sendRes.error);
    process.exit(3);
  }

  console.log("\nchat.send ack:", sendRes.payload);
  console.log("Waiting for stream events (Ctrl+C to stop)...");

  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 90_000);
    process.on("SIGINT", () => {
      clearTimeout(t);
      resolve();
    });
  });

  close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
