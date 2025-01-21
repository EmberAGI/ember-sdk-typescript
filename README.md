# Ember SDK TypeScript

The Ember SDK gives your AI agents on-chain actions. This TypeScript SDK provides a strongly-typed client for interacting with Ember's gRPC API.

## Features

- Full TypeScript support with generated types
- Promise-based API
- Support for chain and token information
- Token swap functionality
- Comprehensive error handling

## Installation

Currently, the best way to use this SDK is to clone it and install it as a local dependency:

```bash
# Clone the repository
git clone https://github.com/EmberAGI/ember-sdk-typescript.git
cd ember-sdk-typescript

# Using Docker (recommended)
docker compose run --rm proto
docker compose run --rm sdk pnpm build

# In your project
cd your-project

# Install the SDK from the local build
pnpm add file:../ember-sdk-typescript

# Install peer dependencies
pnpm add @grpc/grpc-js @grpc/proto-loader
```

npm package installation will be supported in a future release:
```bash
# Coming soon
pnpm add @ember/sdk-typescript
```

## Basic Usage

```typescript
import EmberClient from '@ember/sdk-typescript';

// Create a client instance
const client = new EmberClient({
  endpoint: 'api.emberai.xyz:443', // Replace with actual endpoint
  apiKey: 'your-api-key',       // Optional
});

// Get supported chains
const chains = await client.getChains({
  pageSize: 10,
  filter: '',      // Optional filter string
  pageToken: '',   // Optional pagination token
});

// Get tokens for a specific chain
const tokens = await client.getTokens({
  chainId: 'ethereum',
  pageSize: 20,
  filter: '',      // Optional filter string
  pageToken: '',   // Optional pagination token
});

// Don't forget to close the client when done
client.close();
```

## Advanced Example: LangChain Agent for Token Swaps

Here's an example of using the SDK with LangChain to create an AI agent that can perform token swaps. This example demonstrates:
- Creating LangChain tools from SDK methods
- Setting up an OpenAI-powered agent
- Natural language interaction for swaps
- Error handling
- Resource cleanup

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { createOpenAIToolsAgent, AgentExecutor } from "langchain/agents";
import { pull } from "langchain/hub";
import { StructuredTool } from "@langchain/core/tools";
import EmberClient, { OrderType } from '@ember/sdk-typescript';
import { z } from "zod";

// Create a tool for getting chain information
class GetChainsTool extends StructuredTool {
  name = "get_chains";
  description = "Get a list of supported blockchain chains.";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  async _call() {
    const { chains } = await this.client.getChains({
      pageSize: 10,
      filter: '',
      pageToken: '',
    });
    return JSON.stringify(chains);
  }
}

// Create a tool for getting tokens
class GetTokensTool extends StructuredTool {
  name = "get_tokens";
  description = "Get tokens available on a specific chain.";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  schema = z.object({
    chainId: z.string().describe("The ID of the chain to get tokens for"),
  });

  async _call({ chainId }: { chainId: string }) {
    const { tokens } = await this.client.getTokens({
      chainId,
      pageSize: 100,
      filter: '',
      pageToken: '',
    });
    return JSON.stringify(tokens);
  }
}

// Create a tool for swapping tokens
class SwapTokensTool extends StructuredTool {
  name = "swap_tokens";
  description = "Swap one token for another on a specific chain.";
  client: EmberClient;

  constructor(client: EmberClient) {
    super();
    this.client = client;
  }

  schema = z.object({
    chainId: z.string().describe("The chain ID where the swap will occur"),
    baseTokenId: z.string().describe("The ID of the token you want to buy"),
    quoteTokenId: z.string().describe("The ID of the token you want to sell"),
    amount: z.string().describe("The amount to swap in the smallest unit"),
    recipient: z.string().describe("The wallet address to receive the tokens"),
  });

  async _call({ chainId, baseTokenId, quoteTokenId, amount, recipient }: {
    chainId: string;
    baseTokenId: string;
    quoteTokenId: string;
    amount: string;
    recipient: string;
  }) {
    const swap = await this.client.swapTokens({
      type: OrderType.MARKET_BUY,
      baseToken: { chainId, tokenId: baseTokenId },
      quoteToken: { chainId, tokenId: quoteTokenId },
      amount,
      recipient,
    });
    return JSON.stringify(swap);
  }
}

async function main() {
  const client = new EmberClient({
    endpoint: 'api.emberai.xyz:443',
    apiKey: process.env.EMBER_API_KEY,
  });

  try {
    // Create tools
    const tools = [
      new GetChainsTool(client),
      new GetTokensTool(client),
      new SwapTokensTool(client),
    ];

    // Create the LLM and agent
    const llm = new ChatOpenAI({
      modelName: "gpt-4",
      temperature: 0,
    });

    const prompt = await pull("hwchase17/openai-tools-agent");
    const agent = await createOpenAIToolsAgent({
      llm,
      tools,
      prompt,
    });
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });

    // Execute a swap through natural language
    const result = await agentExecutor.invoke({
      input: "I want to swap 1 WETH worth of USDC on Ethereum.",
    });

    console.log("Agent Response:", result.output);

  } finally {
    client.close();
  }
}
```

You can find more examples in the [examples](./examples) directory.

## Error Handling

The SDK uses standard gRPC error codes:

- `INVALID_ARGUMENT`: The request parameters are malformed or invalid
- `NOT_FOUND`: The requested resource(s) could not be found
- `INTERNAL`: An unexpected server-side error occurred
- `UNAUTHENTICATED`: Authentication failed
- `PERMISSION_DENIED`: Authorization failed

## Development

### Using Docker (Recommended)

The easiest way to develop is using Docker, which ensures a consistent environment with all required tools:

```bash
# Generate proto files
docker compose run --rm proto

# Start development environment
docker compose up sdk

# Run tests
docker compose run --rm sdk pnpm test

# Build the SDK
docker compose run --rm sdk pnpm build
```

### Local Development

If you prefer local development, you'll need:
- Node.js >= 18
- pnpm
- Protocol Buffers compiler (`protoc`)

Then:
```bash
# Install dependencies
pnpm install

# Generate gRPC code from proto files
pnpm run generate-proto

# Build the SDK
pnpm run build

# Run tests
pnpm test
```

## Running the Examples

To run the examples, you'll need to set up your environment variables:

```bash
# Set your API keys
export OPENAI_API_KEY='your-openai-key'
export EMBER_API_KEY='your-ember-key'

# Set your wallet address for receiving tokens
export WALLET_ADDRESS='0x...'

# Run the LangChain swap example
pnpm tsx examples/langchain-swap.ts
```

## License

ISC
