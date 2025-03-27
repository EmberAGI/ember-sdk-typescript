import { Agent } from "./agent.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { EmberGrpcClient } from "@emberai/sdk-typescript";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import { z } from "zod";

dotenv.config();

// Initialize the MCP server
const server = new McpServer({
  name: "mcp-sse-agent-server",
  version: "1.0.0",
});

// RPC and EMBER endpoint setup
const rpc = process.env.RPC_URL || "https://arbitrum.llamarpc.com";
const endpoint = process.env.EMBER_ENDPOINT || "grpc.api.emberai.xyz:50051";

// Create an instance of the Agent class
let agent: Agent;

/**
 * Initializes the Agent instance.
 */
const initializeAgent = async (): Promise<void> => {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("Mnemonic not found in the .env file.");
  }

  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  console.log(`Using wallet ${wallet.address}`);

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const signer = wallet.connect(provider);
  const client = new EmberGrpcClient(endpoint);
  agent = new Agent(client, signer, wallet.address);
  await agent.init();
};


/**
 * Adds tools to the MCP server.
 */
server.tool(
  "borrow",
  {
    tokenName: z.string(),
    amount: z.string(),
  },
  async ({ tokenName, amount }: { tokenName: string; amount: string }) => {
    try {
      console.log(tokenName, amount, "borrow");
      const result = await agent.toolBorrow({ tokenName, amount });
      console.log(result, "borrow");

      return {
        content: [{ type: "text", text: String(result) }],
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

server.tool(
  "repay",
  {
    tokenName: z.string(),
    amount: z.string(),
  },
  async ({ tokenName, amount }: { tokenName: string; amount: string }) => {
    console.log(tokenName, amount, "repay");
    try {
      const result = await agent.toolRepay({ tokenName, amount });
      console.log(result, "repay");

      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

server.tool(
  "supply",
  {
    tokenName: z.string(),
    amount: z.string(),
  },
  async ({ tokenName, amount }: { tokenName: string; amount: string }) => {
    try {
      console.log(tokenName, amount, "supply");
      const result = await agent.toolSupply({ tokenName, amount });
      console.log(result, "supply");

      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

server.tool(
  "withdraw",
  {
    tokenName: z.string(),
    amount: z.string(),
  },
  async ({ tokenName, amount }: { tokenName: string; amount: string }) => {
    try {
      console.log("withdraw11111111111111");
      const result = await agent.toolWithdraw({ tokenName, amount });
      console.log(result, "withdraw");

      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

server.tool(
  "getUserPositions",
  {},
  async () => {
    try {
      const result = await agent.toolGetUserPositions();
      console.log(result, "getUserPositions");
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

server.tool(
  "getAvailableTokens",
  {},
  async () => {
    try {
      const result = await agent.toolGetAvailableTokens();
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
);

// Initialize Express app
const app = express();

// Configure CORS middleware to allow all origins
app.use(cors());

// Add a simple root route handler
app.get("/", (req, res) => {
  res.json({
    name: "MCP SSE Agent Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "/": "Server information (this response)",
      "/sse": "Server-Sent Events endpoint for MCP connection",
      "/messages": "POST endpoint for MCP messages",
    },
    tools: [
      { name: "chat", description: "execute lendiing and borrowing tools using Ember SDK" },
    ],
  });
});

let transport: SSEServerTransport

// SSE endpoint
app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const main = async () => {
  try {
    await initializeAgent();
    app.listen(PORT, () => {
      console.log(`MCP SSE Agent Server running on port ${PORT}`);
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
};

main();