import { Chain } from "../../src/adapters/providers/aave/chain";
import { Agent } from "./agent";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { EmberGrpcClient } from "../../src/lib/client/ember-client.js";

dotenv.config();

// sepolia testnet:

// const rpc = 'https://eth-sepolia.blastapi.io/58417139-0bc7-49b3-9637-ae50b6ecd82b'
// const chainId = 11155111;

// arbitrum one:

const rpc = process.env.AAVE_RPC_URL || "https://arbitrum.llamarpc.com";
const chainId = parseInt(process.env.AAVE_CHAIN_ID || "42161");
const endpoint = process.env.EMBER_ENDPOINT || "grpc.api.emberai.xyz:50051";

const main = async () => {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("Mnemonic not found in the .env file.");
  }

  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  console.log(`Using wallet ${wallet.address}`);

  const chain = new Chain(chainId, rpc); // TODO: can't types from AAVE adapter

  const provider = chain.getProvider();
  const signer = wallet.connect(provider);
  const client = new EmberGrpcClient({ endpoint });
  const agent = new Agent(client, signer, wallet.address);
  agent.start();
};

main();
