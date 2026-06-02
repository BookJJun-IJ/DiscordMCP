import {
  Client,
  GatewayIntentBits,
  TextChannel,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { DiscordConfig, SendEmbedParams } from "./types.js";

export class DiscordClient {
  private client: Client;
  private config: DiscordConfig;
  private ready = false;

  constructor(config: DiscordConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.client.on("ready", () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.ready = true;
    });

    this.client.on("error", (err) => {
      console.error("Discord client error:", err.message);
    });
  }

  async start(): Promise<void> {
    if (!this.config.botToken) throw new Error("No bot token configured");
    await this.client.login(this.config.botToken);
  }

  async stop(): Promise<void> {
    this.client.destroy();
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  getBotTag(): string | null {
    return this.client.user?.tag || null;
  }

  getGuildCount(): number {
    return this.client.guilds.cache.size;
  }

  updateConfig(config: DiscordConfig): void {
    this.config = config;
  }

  getDefaultChannelId(): string | undefined {
    return this.config.defaultChannelId;
  }

  getDefaultGuildId(): string | undefined {
    return this.config.defaultGuildId;
  }

  private resolveChannelId(providedChannelId?: string): string {
    if (providedChannelId) return providedChannelId;
    if (this.config.defaultChannelId) return this.config.defaultChannelId;
    throw new Error(
      "Missing channelId: provide it in the tool call or set a default in config"
    );
  }

  private resolveGuildId(providedGuildId?: string): string {
    if (providedGuildId) return providedGuildId;
    if (this.config.defaultGuildId) return this.config.defaultGuildId;
    // Fall back to first guild
    const firstGuild = this.client.guilds.cache.first();
    if (firstGuild) return firstGuild.id;
    throw new Error(
      "Missing guildId: provide it in the tool call or set a default in config"
    );
  }

  async sendMessage(channelId?: string, text?: string): Promise<string> {
    if (!this.ready) throw new Error("Discord bot is not connected");
    if (!text) throw new Error("Missing required parameter: text");

    const resolvedId = this.resolveChannelId(channelId);
    const channel = await this.client.channels.fetch(resolvedId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`Channel ${resolvedId} is not a text channel`);
    }

    const msg = await (channel as TextChannel).send(text);
    return msg.id;
  }

  async sendEmbed(params: SendEmbedParams): Promise<string> {
    if (!this.ready) throw new Error("Discord bot is not connected");

    const resolvedId = this.resolveChannelId(params.channelId);
    const channel = await this.client.channels.fetch(resolvedId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`Channel ${resolvedId} is not a text channel`);
    }

    const embed = new EmbedBuilder().setTitle(params.title);

    if (params.description) embed.setDescription(params.description);
    if (params.color !== undefined) embed.setColor(params.color);
    if (params.url) embed.setURL(params.url);
    if (params.footer) embed.setFooter({ text: params.footer });
    if (params.timestamp) embed.setTimestamp();
    if (params.fields) {
      for (const f of params.fields) {
        embed.addFields({ name: f.name, value: f.value, inline: f.inline });
      }
    }

    const msg = await (channel as TextChannel).send({ embeds: [embed] });
    return msg.id;
  }

  async listChannels(guildId?: string): Promise<
    Array<{ id: string; name: string; type: string }>
  > {
    if (!this.ready) throw new Error("Discord bot is not connected");

    const resolvedGuildId = this.resolveGuildId(guildId);
    const guild = await this.client.guilds.fetch(resolvedGuildId);
    const channels = await guild.channels.fetch();

    return channels
      .filter((ch) => ch !== null && ch.type === ChannelType.GuildText)
      .map((ch) => ({
        id: ch!.id,
        name: ch!.name,
        type: "text",
      }));
  }
}
