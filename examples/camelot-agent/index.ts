import { Agent } from "./agent";
import * as dotenv from "dotenv";
import { EmberGrpcClient } from "@emberai/sdk-typescript";
import { MultiChainSigner } from "../../test/multichain-signer";

dotenv.config();

const endpoint = process.env.EMBER_ENDPOINT || "grpc.api.emberai.xyz:50051";

const main = async () => {
  console.log("Starting Camelot Agent using endpoint: ", endpoint);
  const client = new EmberGrpcClient(endpoint);
  const signer = await MultiChainSigner.fromEnv();
  const agent = new Agent(client, signer);
  await agent.start();
};

main();
