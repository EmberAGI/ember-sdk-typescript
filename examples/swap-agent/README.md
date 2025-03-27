# Swap Agent

An interactive command-line agent for swapping tokens using the Ember SDK. This agent supports multiple chains including Ethereum, Base, and Arbitrum.

## Features

- Interactive command-line interface
- Support for multiple chains (Ethereum, Base, Arbitrum)
- Token price checking
- Token swapping with market buy/sell orders
- Automatic gas estimation
- Transaction status tracking

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- An OpenAI API key
- A wallet mnemonic phrase
- RPC URLs for the chains you want to use

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root with the following variables:
```env
# Required
MNEMONIC=your_wallet_mnemonic_phrase
OPENAI_API_KEY=your_openai_api_key

# Optional (defaults provided)
CHAIN_ID=1  # 1 for Ethereum, 8453 for Base, 42161 for Arbitrum
EMBER_ENDPOINT=grpc.api.emberai.xyz:50051

# Optional RPC URLs (defaults provided)
ETH_RPC_URL=https://eth.llamarpc.com
BASE_RPC_URL=https://mainnet.base.org
ARB_RPC_URL=https://arbitrum.llamarpc.com
```

## Usage

1. Start the agent:
```bash
npm start
```

2. Interact with the agent using natural language. Examples:
- "What's the price of WETH in USDC?"
- "Swap 1 WETH for USDC"
- "How much USDC can I get for 0.1 WETH?"

## Supported Chains

- Ethereum (Chain ID: 1)
- Base (Chain ID: 8453)
- Arbitrum (Chain ID: 42161)

## Security Notes

- Never share your mnemonic phrase or private keys
- Keep your `.env` file secure and never commit it to version control
- Review transaction details before confirming any swaps

## Error Handling

The agent will provide clear error messages for common issues such as:
- Insufficient balance
- Slippage too high
- Network errors
- Invalid token pairs
- Gas estimation failures

## Contributing

Feel free to submit issues and enhancement requests! 