import dotenv from "dotenv";
import { definePool, Instance } from "prool";
import { anvil } from "prool/instances";
import { ethers } from "ethers";
import { spawn } from "child_process";
import * as process from "process";
import readline from "readline";

dotenv.config();

const originalRpcUrl = process.env.ETH_RPC_URL;
if (!originalRpcUrl) throw new Error("No ETH_RPC_URL provided");

const mnemonic = process.env.MNEMONIC;
if (!mnemonic) throw new Error("Mnemonic not found in the .env file.");

const pool = definePool({
  instance: anvil({
    mnemonic: mnemonic,
    forkUrl: originalRpcUrl,
  }),
});

const instance = (await pool.start(1, {
  port: parseInt(process.env.ANVIL_PORT || "3070"),
})) as Instance;

const rpcUrl = `http://${instance.host}:${instance.port}`;
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const { chainId } = await provider.getNetwork();
const blockNumber = await provider.getBlockNumber();

function handleStream(
  stream: NodeJS.ReadableStream,
  tag: string,
  logFn: (message: string) => void,
): void {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    logFn(`[${tag}] ${line}`);
  });
}

async function runCommand(
  command: string,
  source: string,
  options = {},
  waitFor?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[${source}] Running: ${command}`);
    const child = spawn(command, { shell: true, ...options });
    let resolved = false;
    const resolveOnce = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    handleStream(child.stdout, source, (line) => {
      console.log(line);
      if (waitFor && line.includes(waitFor)) {
        resolveOnce();
      }
    });

    handleStream(child.stderr, source, (line) => {
      console.error(line);
    });

    child.on("close", (code) => {
      if (waitFor) {
        if (!resolved) {
          reject(
            new Error(
              `[${source}] Command "${command}" closed with code ${code} without emitting waitFor string "${waitFor}"`,
            ),
          );
        }
      } else {
        if (code === 0) {
          resolveOnce();
        } else {
          reject(
            new Error(
              `[${source}] Command "${command}" exited with code ${code}`,
            ),
          );
        }
      }
    });
    child.on("error", (err) => reject(err));
  });
}

process.chdir("onchain-actions");
process.env.AAVE_RPC_URL = rpcUrl;
await runCommand(
  "docker compose -f compose.local.yaml up -d --wait",
  "compose",
);
await runCommand("pnpm install --ignore-workspace", "install");
try {
  await runCommand(
    "pnpm run dev --ignore-workspace",
    "dev",
    {},
    "service running",
  );
} catch (e) {
  console.error(e);
  throw new Error(
    "Did you forget to populate .env in the onchain-actions/ folder?\nGo to onchain-actions and fix this problem manually: the goal is to be able to run `pnpm run dev`",
  );
}

console.log("Chain ID:", chainId);
console.log("Latest Block Number:", blockNumber);
console.log();
console.log("Anvil instance started. Ensure this configuration is used:");
console.log();
console.log(`TEST_RPC_URL=${rpcUrl}`);
console.log(`ANVIL_PORT=${instance.port}`);
console.log();
// DO NOT EDIT the line below, CI depends on it
console.log("You can run integration tests now");
