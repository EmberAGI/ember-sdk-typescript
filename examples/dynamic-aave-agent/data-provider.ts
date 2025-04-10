import {
  ChainName,
  LendingToolDataProvider,
  TokenName,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";

export class MockLendingToolDataProvider implements LendingToolDataProvider {
  constructor(public tokens: Record<TokenName, ChainName[]>) {}

  async getAvailableTokens(): Promise<TokenName[]> {
    return [...Object.keys(this.tokens)];
  }

  async getAvailableChainsForToken(token: TokenName): Promise<ChainName[]> {
    return this.tokens[token];
  }

  async getAvailableTokensForChain(chain: ChainName): Promise<TokenName[]> {
    const tokens: Set<TokenName> = new Set();
    Object.entries(this.tokens).forEach(([tokenName, chains]) => {
      if (chains.includes(chain)) {
        tokens.add(tokenName);
      }
    });
    return Array.from(tokens);
  }

  async getAvailableChains(): Promise<ChainName[]> {
    const chains: Set<ChainName> = new Set();
    Object.values(this.tokens).forEach((tokenChains) =>
      tokenChains.forEach((chain) => chains.add(chain)),
    );
    return Array.from(chains);
  }
}
