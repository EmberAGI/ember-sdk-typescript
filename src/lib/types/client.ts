import type {
  GetChainsRequest,
  GetChainsResponse,
  GetTokensRequest,
  GetTokensResponse,
  SwapTokensRequest,
  SwapTokensResponse,
  GetProviderTrackingStatusRequest,
  GetProviderTrackingStatusResponse,
  BorrowTokensRequest,
  BorrowTokensResponse,
  RepayTokensRequest,
  RepayTokensResponse,
  SupplyTokensRequest,
  SupplyTokensResponse,
  WithdrawTokensRequest,
  WithdrawTokensResponse,
  GetWalletPositionsRequest,
  GetWalletPositionsResponse,
  TransactionPlan,
  GetCapabilitiesRequest,
  GetCapabilitiesResponse
} from '../../generated/onchain_actions.js';

export interface EmberClientConfig {
  /** gRPC endpoint URL */
  endpoint: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

export interface EmberClient {
  /** Get supported blockchain networks */
  getChains(request: GetChainsRequest): Promise<GetChainsResponse>;
  
  /** Get tokens, optionally filtered by chain */
  getTokens(request: GetTokensRequest): Promise<GetTokensResponse>;
  
  /** Create a token swap transaction */
  swapTokens(request: SwapTokensRequest): Promise<SwapTokensResponse>;
  
  /** Get the tracking status of a transaction from a provider */
  getProviderTrackingStatus(request: GetProviderTrackingStatusRequest): Promise<GetProviderTrackingStatusResponse>;
  
  /** AAVE-specific methods */
  getCapabilities(request: GetCapabilitiesRequest): Promise<GetCapabilitiesResponse>;
  borrowTokens(request: BorrowTokensRequest): Promise<BorrowTokensResponse>;
  repayTokens(request: RepayTokensRequest): Promise<RepayTokensResponse>;
  supplyTokens(request: SupplyTokensRequest): Promise<SupplyTokensResponse>;
  withdrawTokens(request: WithdrawTokensRequest): Promise<WithdrawTokensResponse>;
  getWalletPositions(request: GetWalletPositionsRequest): Promise<GetWalletPositionsResponse>;

  /** Close the client connection */
  close(): void;
} 