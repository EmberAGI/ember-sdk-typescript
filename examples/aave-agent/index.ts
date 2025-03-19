import { Agent } from "./agent.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { EmberGrpcClient } from "@emberai/sdk-typescript";

dotenv.config();

const rpc = process.env.AAVE_RPC_URL || "https://arbitrum.llamarpc.com";
const endpoint = process.env.EMBER_ENDPOINT || "grpc.api.emberai.xyz:50051";

const main = async () => {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("Mnemonic not found in the .env file.");
  }

  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  console.log(`Using wallet ${wallet.address}`);

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const signer = wallet.connect(provider);
  const client = new EmberGrpcClient({ endpoint });
  const agent = new Agent(client, signer, wallet.address);
  // agent.start();
  agent.startServer()
};

main();
