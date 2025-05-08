import { ethers } from "ethers";
import * as process from "process";

/**
 * Discovers all available anvil chains by checking each port starting from ANVIL_PORT
 * @returns An array of objects containing chainId and rpcUrl for each discovered chain
 */
export const discoverChains = async (): Promise<
  Array<{ chainId: number; rpcUrl: string }>
> => {
  const startPort = parseInt(process.env.ANVIL_PORT || "3070");
  const discoveredChains: Array<{ chainId: number; rpcUrl: string }> = [];
  let currentPort = startPort;

  // Try connecting to ports and discover chains
  while (true) {
    const rpcUrl = `http://localhost:${currentPort}`;
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      // Add a short timeout to prevent hanging if the RPC is not responsive
      const networkPromise = provider.getNetwork();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out")), 1000),
      );

      const network = (await Promise.race([
        networkPromise,
        timeoutPromise,
      ])) as ethers.providers.Network;

      discoveredChains.push({
        chainId: network.chainId,
        rpcUrl,
      });

      // Move to the next port
      currentPort++;
    } catch (_error) {
      // If we can't connect to this port, we've likely found all chains
      break;
    }
  }

  return discoveredChains;
};

export const validateRequiredChains = (
  requiredChainIds: number[],
  availableChains: Array<{ chainId: number; rpcUrl: string }>,
): void => {
  const availableChainIds = availableChains.map((chain) => chain.chainId);

  for (const requiredChainId of requiredChainIds) {
    if (!availableChainIds.includes(requiredChainId)) {
      throw new Error(
        `Required chain ID ${requiredChainId} is not available. Available chains: ${availableChainIds.join(", ")}`,
      );
    }
  }
};

export const getRpcUrlForChain = (
  chainId: number,
  availableChains: Array<{ chainId: number; rpcUrl: string }>,
): string => {
  const chain = availableChains.find((chain) => chain.chainId === chainId);
  if (!chain) {
    throw new Error(
      `Chain ID ${chainId} not found in available chains: ${availableChains.map((c) => c.chainId).join(", ")}`,
    );
  }
  return chain.rpcUrl;
};
