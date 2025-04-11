import { LendingToolPayload } from "@emberai/sdk-typescript";
import {
  ChainName,
  LendingToolDataProvider,
  TokenName,
} from "../../onchain-actions/build/src/services/api/dynamic/aave.js";

export class MockLendingToolDataProvider implements LendingToolDataProvider {
  constructor(public tokens: Record<TokenName, ChainName[]>) {}

  async getAvailableTokens(payload: LendingToolPayload): Promise<TokenName[]> {
    // If there is a specified chain name, only limit tokens to that chain
    if (typeof payload.specifiedChainName !== 'undefined') {
      const tokens: Set<TokenName> = new Set();
      Object.entries(this.tokens).forEach(([tokenName, chains]) => {
        if (chains.includes(payload.specifiedChainName)) {
          tokens.add(tokenName);
        }
      });
      return Array.from(tokens);
    } else {
      return [...Object.keys(this.tokens)];
    }
  }

  async getAvailableChains(payload: LendingToolPayload): Promise<ChainName[]> {
    // If there is a specified token name, only return chains that have it
    if (typeof payload.specifiedTokenName !== 'undefined') {
      return this.tokens[payload.specifiedTokenName];
    } else {
      const chains: Set<ChainName> = new Set();
      Object.values(this.tokens).forEach(
        (tokenChains) =>
          tokenChains.forEach((chain) => chains.add(chain)),
      );
      return Array.from(chains);
    }
  }
}
