import { Agent } from "./agent.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { EmberGrpcClient } from "@emberai/sdk-typescript";
import { MultiChainSigner } from "../../test/multichain-signer.js";

dotenv.config();

const main = async () => {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("Mnemonic not found in the .env file.");
  }

  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  console.log(`Using wallet ${wallet.address}`);

  const endpoint = process.env.EMBER_ENDPOINT || "grpc.api.emberai.xyz:50051";
  console.log(`Connecting to ${endpoint}`);

  const signer = await MultiChainSigner.fromEnv();
  const client = new EmberGrpcClient(endpoint);
  const agent = new Agent(client, signer);
  await agent.start();
};

main().catch(error => {
  console.error("Error in main:", error);
  process.exit(1);
}); 