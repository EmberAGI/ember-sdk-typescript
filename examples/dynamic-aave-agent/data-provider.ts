import {
  ChainName,
  LendingToolDataProvider,
  TokenName,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";

export class MockLendingToolDataProvider implements LendingToolDataProvider {
  constructor(public tokenNames: Record<TokenName, ChainName[]>) {}

  async getAvailableTokenNames(): Promise<TokenName[]> {
    return [...Object.keys(this.tokenNames)];
  }

  async getAvailableChainNamesForToken(token: TokenName): Promise<ChainName[]> {
    return this.tokenNames[token];
  }

  async getAvailableTokenNamesForChain(chain: ChainName): Promise<TokenName[]> {
    const tokenNames: Set<TokenName> = new Set();
    Object.entries(this.tokenNames).forEach(([tokenName, chainNames]) => {
      if (chainNames.includes(chain)) {
        tokenNames.add(tokenName);
      }
    });
    return Array.from(tokenNames);
  }

  async getAvailableChainNames(): Promise<ChainName[]> {
    const chainNames: Set<ChainName> = new Set();
    Object.values(this.tokenNames).forEach((tokenChains) =>
      tokenChains.forEach((chain) => chainNames.add(chain)),
    );
    return Array.from(chainNames);
  }
}
