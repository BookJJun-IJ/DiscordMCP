import { createApi } from "./api.js";
import { DiscordClient } from "./discord-client.js";
import { loadConfig, isPlaceholderConfig } from "./config.js";
import { MCPServer } from "./mcp-server.js";

import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { createDiscoveryResponder } = _require("../mcp-announce.cjs");

async function main(): Promise<void> {
  console.log("Starting Discord MCP...");

  let config = loadConfig();
  console.log("Config loaded");

  const discord = new DiscordClient(config);
  const mcpServer = new MCPServer(discord);

  const restart = async (): Promise<void> => {
    console.log("Restarting...");
    await discord.stop();

    config = loadConfig();
    discord.updateConfig(config);

    if (!isPlaceholderConfig(config)) {
      await discord.start();
    }
    console.log("Restart complete");
  };

  const app = createApi({
    discord,
    mcpServer,
    onRestart: restart,
  });

  const port = parseInt(process.env.PORT || String(config.server?.port || 9640), 10);
  const server = app.listen(port, () => {
    console.log(`Web UI available at http://localhost:${port}`);
    console.log(`MCP Server available at http://localhost:${port}/mcp`);

    // Beacon discovery
    createDiscoveryResponder({
      name: "discord-mcp",
      description: "Discord bot bridge — send messages and embeds to Discord channels",
      tools: [
        {
          name: "send_message",
          description: "Send a text message to a Discord channel",
          inputSchema: {
            type: "object",
            properties: {
              channelId: { type: "string" },
              text: { type: "string" },
            },
            required: ["text"],
          },
        },
        {
          name: "send_embed",
          description: "Send a rich embed message to a Discord channel",
          inputSchema: {
            type: "object",
            properties: {
              channelId: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              color: { type: "number" },
              fields: { type: "array" },
              footer: { type: "string" },
              timestamp: { type: "boolean" },
            },
            required: ["title"],
          },
        },
        {
          name: "list_channels",
          description: "List all text channels in a Discord server",
          inputSchema: {
            type: "object",
            properties: {
              guildId: { type: "string" },
            },
          },
        },
        {
          name: "echo",
          description: "Echo a message back — useful for testing the MCP connection",
          inputSchema: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            required: ["message"],
          },
        },
      ],
      port,
      listenPort: parseInt(process.env.DISCOVERY_PORT || "9099"),
    });
  });

  const setupMode = isPlaceholderConfig(config);

  if (setupMode) {
    console.log("============================================");
    console.log("  Discord MCP is running in SETUP MODE.");
    console.log("  No bot token configured yet.");
    console.log(`  Open http://localhost:${port} to configure.`);
    console.log("============================================");
  } else {
    try {
      await discord.start();
    } catch (err) {
      console.warn(
        "Bot failed to start (configure via Web UI):",
        err instanceof Error ? err.message : err
      );
    }
    console.log("Discord MCP is running.");
  }

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}, shutting down...`);
    server.close();
    await discord.stop();
    await mcpServer.stop();
    console.log("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
