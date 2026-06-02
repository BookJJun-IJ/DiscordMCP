export interface DiscordConfig {
  botToken: string;
  defaultGuildId?: string;
  defaultChannelId?: string;
  server?: {
    port?: number;
  };
}

export interface SendMessageParams {
  channelId?: string;
  text: string;
}

export interface SendEmbedParams {
  channelId?: string;
  title: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  url?: string;
  footer?: string;
  timestamp?: boolean;
}

export interface ListChannelsParams {
  guildId?: string;
}
