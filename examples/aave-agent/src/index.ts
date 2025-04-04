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

let isReady = false;

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
  isReady = true;
  console.log("Agent initialized successfully");
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
      const result = await agent.toolBorrow({ tokenName, amount });

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
    try {
      const result = await agent.toolRepay({ tokenName, amount });

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
      const result = await agent.toolSupply({ tokenName, amount });

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
      const result = await agent.toolWithdraw({ tokenName, amount });

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
app.get("/", (_req, res) => {
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


// endpoint to check server health
app.get("/health", (_req, res) => {
  if (!isReady) {
    res.status(503).json({ status: "starting" });
  }
  res.status(200).json({ status: "ok" });
});


// Store active SSE connections
const sseConnections = new Set();

let transport: SSEServerTransport

// SSE endpoint
app.get("/sse", async (_req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);

  // Add connection to active set
  sseConnections.add(res);

  // Setup keepalive interval
  const keepaliveInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(keepaliveInterval);
      return;
    }
    res.write(':keepalive\n\n');
  }, 30000); // Send keepalive every 30 seconds

  // Handle client disconnect
  _req.on('close', () => {
    clearInterval(keepaliveInterval);
    sseConnections.delete(res);
    transport.close?.();
  });

  // Handle errors
  res.on('error', (err) => {
    console.error('SSE Error:', err);
    clearInterval(keepaliveInterval);
    sseConnections.delete(res);
    transport.close?.();
  });
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