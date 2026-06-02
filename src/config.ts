import fs from "fs";
import path from "path";
import { DiscordConfig } from "./types.js";

const CONFIG_PATH = process.env.CONFIG_PATH || path.join(process.cwd(), "data", "config.json");
const EXAMPLE_PATH = path.join(process.cwd(), "config.example.json");

const PLACEHOLDER_TOKEN = "YOUR_DISCORD_BOT_TOKEN_HERE";

export function loadConfig(): DiscordConfig {
  // Try loading from config path
  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as DiscordConfig;
  }

  // Fall back to example config
  if (fs.existsSync(EXAMPLE_PATH)) {
    const raw = fs.readFileSync(EXAMPLE_PATH, "utf8");
    return JSON.parse(raw) as DiscordConfig;
  }

  // Default config
  return {
    botToken: PLACEHOLDER_TOKEN,
  };
}

export function saveConfig(config: DiscordConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function isPlaceholderConfig(config: DiscordConfig): boolean {
  return !config.botToken || config.botToken === PLACEHOLDER_TOKEN;
}
