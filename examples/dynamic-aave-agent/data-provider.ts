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
}
