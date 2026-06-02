import express, { Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { DiscordClient } from "./discord-client.js";
import { MCPServer } from "./mcp-server.js";
import { loadConfig, saveConfig, isPlaceholderConfig } from "./config.js";
import { DiscordConfig } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ApiOptions {
  discord: DiscordClient;
  mcpServer: MCPServer;
  onRestart: () => Promise<void>;
}

export function createApi({ discord, mcpServer, onRestart }: ApiOptions): Express {
  const app = express();

  app.use(express.json());

  // MCP endpoint
  app.use("/mcp", mcpServer.createRouter());

  // API: status
  app.get("/api/status", (_req, res) => {
    const config = loadConfig();
    res.json({
      botConnected: discord.isReady(),
      botTag: discord.getBotTag(),
      guildCount: discord.getGuildCount(),
      defaultChannelId: config.defaultChannelId || null,
      defaultGuildId: config.defaultGuildId || null,
      setupMode: isPlaceholderConfig(config),
    });
  });

  // API: get config (masked token)
  app.get("/api/config", (_req, res) => {
    const config = loadConfig();
    res.json({
      botToken: config.botToken ? "***configured***" : "",
      defaultGuildId: config.defaultGuildId || "",
      defaultChannelId: config.defaultChannelId || "",
    });
  });

  // API: save config
  app.post("/api/config", async (req, res) => {
    const { botToken, defaultGuildId, defaultChannelId } = req.body;
    const current = loadConfig();

    const newConfig: DiscordConfig = {
      botToken: botToken && botToken !== "***configured***" ? botToken : current.botToken,
      defaultGuildId: defaultGuildId || undefined,
      defaultChannelId: defaultChannelId || undefined,
    };

    saveConfig(newConfig);

    try {
      await onRestart();
      res.json({ ok: true, message: "Configuration saved and bot restarted" });
    } catch (err) {
      res.json({
        ok: false,
        message: `Config saved but bot failed to start: ${err instanceof Error ? err.message : err}`,
      });
    }
  });

  // Serve web UI
  app.use(express.static(path.join(__dirname, "..", "web")));

  // Fallback to index.html
  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "web", "index.html"));
  });

  return app;
}
