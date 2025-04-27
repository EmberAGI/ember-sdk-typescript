import "dotenv/config";

export type ChainTokenConfig = {
  name: string;
  address: string;
};

export type ChainConfig = {
  name: string;
  rpcUrl: string;
  varName: string;
  wrappedNativeToken?: ChainTokenConfig;
  anotherToken?: ChainTokenConfig; // Some tests, in particular algebra.mainnet-test.ts require at least one known token besides native
};

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  42161: {
    name: "Arbitrum One",
    rpcUrl:
      process.env.ARBITRUM_ONE_RPC_URL ||
      "https://arbitrum.gateway.tenderly.co",
    varName: "ARBITRUM_ONE",
    wrappedNativeToken: {
      name: "WETH",
      address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    },
    anotherToken: {
      name: "WETH",
      address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    },
  },
  421614: {
    name: "Arbitrum Sepolia Testnet",
    rpcUrl:
      process.env.ARBITRUM_SEPOLIA_RPC_URL ||
      "https://omniscient-capable-wave.arbitrum-sepolia.quiknode.pro/c51336f65cc5f7af0a1b9fcd709b646d628782b4",
    varName: "ARBITRUM_SEPOLIA",
  },
  33139: {
    name: "ApeChain",
    rpcUrl:
      process.env.APECHAIN_RPC_URL || "https://apechain.calderachain.xyz/http",
    varName: "APECHAIN",
    wrappedNativeToken: {
      name: "wAPE",
      address: "0x48b62137EdfA95a428D35C09E44256a739F6B557",
    },
    anotherToken: {
      name: "ApeUSD",
      address: "0xA2235d059F80e176D931Ef76b6C51953Eb3fBEf4",
    },
  },
  33111: {
    name: "ApeChain Curtis Testnet",
    rpcUrl:
      process.env.APECHAIN_CURTIS_RPC_URL ||
      "https://curtis.rpc.caldera.xyz/http",
    varName: "APECHAIN_CURTIS",
  },
  8453: {
    name: "Base Chain",
    rpcUrl:
      process.env.BASE_CHAIN_RPC_URL || "https://base.gateway.tenderly.co",
    varName: "BASE_CHAIN",
  },
};
