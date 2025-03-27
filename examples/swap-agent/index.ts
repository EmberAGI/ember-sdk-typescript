import { Agent } from "./agent.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { EmberGrpcClient } from "@emberai/sdk-typescript";

dotenv.config();

// Chain configurations
const CHAIN_CONFIGS: Record<string, { rpc: string; name: string }> = {
  // Mainnet chains
  "1": {
    rpc: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
    name: "Ethereum",
  },
  "8453": {
    rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    name: "Base",
  },
  "42161": {
    rpc: process.env.ARB_RPC_URL || "https://arbitrum.llamarpc.com",
    name: "Arbitrum",
  },
  // Sepolia testnet chains
  "11155111": {
    rpc: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/your-project-id",
    name: "Sepolia",
  },
  "84531": {
    rpc: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    name: "Base Sepolia",
  },
  "421614": {
    rpc: process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    name: "Arbitrum Sepolia",
  },
};

const main = async () => {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("Mnemonic not found in the .env file.");
  }

  const chainId = process.env.CHAIN_ID || "11155111"; // Default to Sepolia
  const chainConfig = CHAIN_CONFIGS[chainId];
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  console.log(`Using chain: ${chainConfig.name} (ID: ${chainId})`);

  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  console.log(`Using wallet ${wallet.address}`);

  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpc);
  const signer = wallet.connect(provider);
  const client = new EmberGrpcClient(process.env.EMBER_ENDPOINT || "grpc.api.emberai.xyz:50051");
  const agent = new Agent(client, signer, wallet.address, chainId);
  agent.start();
};

main(); 