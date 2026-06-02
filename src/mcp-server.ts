import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response, Router } from "express";
import { DiscordClient } from "./discord-client.js";
import { SendMessageParams, SendEmbedParams, ListChannelsParams } from "./types.js";

export class MCPServer {
  private discord: DiscordClient;

  constructor(discord: DiscordClient) {
    this.discord = discord;
  }

  private createServer(): Server {
    const server = new Server(
      {
        name: "discord-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers(server);
    return server;
  }

  private setupHandlers(server: Server): void {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "send_message",
            description:
              "Send a text message to a Discord channel. If channelId is omitted, the message is sent to the configured default channel.",
            inputSchema: {
              type: "object" as const,
              properties: {
                channelId: {
                  type: "string",
                  description:
                    "The Discord channel ID to send the message to (optional if default is configured)",
                },
                text: {
                  type: "string",
                  description: "The text message to send",
                },
              },
              required: ["text"],
            },
          },
          {
            name: "send_embed",
            description:
              "Send a rich embed message to a Discord channel. If channelId is omitted, the embed is sent to the configured default channel.",
            inputSchema: {
              type: "object" as const,
              properties: {
                channelId: {
                  type: "string",
                  description:
                    "The Discord channel ID (optional if default is configured)",
                },
                title: {
                  type: "string",
                  description: "The embed title",
                },
                description: {
                  type: "string",
                  description: "The embed description/body text",
                },
                color: {
                  type: "number",
                  description: "Embed color as decimal integer (e.g. 5025616 for green)",
                },
                url: {
                  type: "string",
                  description: "URL that the embed title links to",
                },
                fields: {
                  type: "array",
                  description: "Embed fields",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      value: { type: "string" },
                      inline: { type: "boolean" },
                    },
                    required: ["name", "value"],
                  },
                },
                footer: {
                  type: "string",
                  description: "Footer text",
                },
                timestamp: {
                  type: "boolean",
                  description: "Whether to include a timestamp",
                },
              },
              required: ["title"],
            },
          },
          {
            name: "list_channels",
            description:
              "List all text channels in a Discord server (guild). If guildId is omitted, uses the configured default or the first available guild.",
            inputSchema: {
              type: "object" as const,
              properties: {
                guildId: {
                  type: "string",
                  description:
                    "The Discord guild (server) ID (optional if default is configured)",
                },
              },
              required: [],
            },
          },
          {
            name: "echo",
            description:
              "Echo a message back — useful for testing the MCP connection",
            inputSchema: {
              type: "object" as const,
              properties: {
                message: {
                  type: "string",
                  description: "The message to echo back",
                },
              },
              required: ["message"],
            },
          },
        ],
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "send_message": {
            const params = args as unknown as SendMessageParams;
            if (!params.text) {
              throw new Error("Missing required parameter: text");
            }
            const msgId = await this.discord.sendMessage(
              params.channelId,
              params.text
            );
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Message sent (id: ${msgId})`,
                },
              ],
            };
          }

          case "send_embed": {
            const params = args as unknown as SendEmbedParams;
            if (!params.title) {
              throw new Error("Missing required parameter: title");
            }
            const msgId = await this.discord.sendEmbed(params);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Embed sent (id: ${msgId})`,
                },
              ],
            };
          }

          case "list_channels": {
            const params = args as unknown as ListChannelsParams;
            const channels = await this.discord.listChannels(params.guildId);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(channels, null, 2),
                },
              ],
            };
          }

          case "echo": {
            const { message } = args as { message: string };
            if (!message) throw new Error("Missing required parameter: message");
            return {
              content: [{ type: "text" as const, text: message }],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  createRouter(): Router {
    const router = Router();

    router.post("/", express.json(), async (req: Request, res: Response) => {
      console.log("MCP HTTP POST request received");

      const server = this.createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", () => {
        server.close().catch(console.error);
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    return router;
  }

  async stop(): Promise<void> {
    console.log("MCP Server stopped");
  }
}
