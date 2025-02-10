# Ember SDK TypeScript

The Ember SDK gives your AI agents on-chain actions. This TypeScript SDK provides a strongly-typed client for interacting with Ember's gRPC API.

> **Beta Release**: This SDK is currently in beta. The API is unstable and may change between versions.

## Features

- Full TypeScript support with generated types
- Promise-based API
- Support for chain and token information
- Token swap functionality
- Comprehensive error handling

## Installation

Install the SDK and its peer dependencies:

```bash
# Using pnpm (recommended)
pnpm add @emberai/sdk-typescript@beta @grpc/grpc-js @grpc/proto-loader

# Using npm
npm install @emberai/sdk-typescript@beta @grpc/grpc-js @grpc/proto-loader

# Using yarn
yarn add @emberai/sdk-typescript@beta @grpc/grpc-js @grpc/proto-loader
```

> Note: During the beta period, you must explicitly use the `@beta` tag when installing. This ensures you're aware that the API may change between versions.

## Basic Usage

```typescript
import EmberClient from '@emberai/sdk-typescript';

// Create a client instance
const client = new EmberClient({
  endpoint: 'grpc.api.emberai.xyz:50051',
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

## Examples

The SDK comes with several example implementations in the [`examples`](./examples) directory:

- [`token-swap.ts`](./examples/token-swap.ts) - A basic example demonstrating how to perform token swaps using the SDK with Viem for Ethereum interaction. Shows wallet setup, token swapping, and transaction handling.
- [`langchain-swap.ts`](./examples/langchain-swap.ts) - An advanced example showing how to integrate the SDK with LangChain to create an AI agent that can perform token swaps through natural language commands. Demonstrates creating custom tools, setting up an OpenAI-powered agent, and handling complex interactions.

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

# Build the SDK
docker compose run --rm sdk pnpm build

# Run tests
docker compose run --rm sdk pnpm test
``` 

_or_

```bash
docker compose run --rm -e TEST_ENV=live sdk pnpm test
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
