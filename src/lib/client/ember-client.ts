import {
  GetChainsRequest,
  GetChainsResponse,
  GetTokensRequest,
  GetTokensResponse,
  GetCapabilitiesRequest,
  GetCapabilitiesResponse,
  GetWalletPositionsRequest,
  GetWalletPositionsResponse,
  GetUserLiquidityPositionsRequest,
  GetUserLiquidityPositionsResponse,
  SwapTokensRequest,
  SwapTokensResponse,
  BorrowTokensRequest,
  BorrowTokensResponse,
  RepayTokensRequest,
  RepayTokensResponse,
  SupplyTokensRequest,
  SupplyTokensResponse,
  WithdrawTokensRequest,
  WithdrawTokensResponse,
  SupplyLiquidityRequest,
  SupplyLiquidityResponse,
  WithdrawLiquidityRequest,
  WithdrawLiquidityResponse,
  GetLiquidityPoolsResponse,
  GetProviderTrackingStatusRequest,
  GetProviderTrackingStatusResponse,
  ClientOptions,
} from "../../generated/onchain_actions";

/**
 * EmberClient provides methods to interact with the On-chain Actions API.
 */
export class EmberHttpClient {
  private baseUrl: string;
  private options: ClientOptions;

  constructor(baseUrl: string, options?: Partial<ClientOptions>) {
    // In this HTTP implementation, the address is the base URL.
    this.baseUrl = baseUrl;
    this.options = { baseUrl, ...options };
  }

  private async post<TRequest, TResponse>(
    url: string,
    body: TRequest,
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as TResponse;
  }

  // DataService methods
  getChains(request: GetChainsRequest): Promise<GetChainsResponse> {
    return this.post<GetChainsRequest, GetChainsResponse>(
      "/data/getChains",
      request,
    );
  }

  getTokens(request: GetTokensRequest): Promise<GetTokensResponse> {
    return this.post<GetTokensRequest, GetTokensResponse>(
      "/data/getTokens",
      request,
    );
  }

  getCapabilities(
    request: GetCapabilitiesRequest,
  ): Promise<GetCapabilitiesResponse> {
    return this.post<GetCapabilitiesRequest, GetCapabilitiesResponse>(
      "/data/getCapabilities",
      request,
    );
  }

  // WalletContext methods
  getWalletPositions(
    request: GetWalletPositionsRequest,
  ): Promise<GetWalletPositionsResponse> {
    return this.post<GetWalletPositionsRequest, GetWalletPositionsResponse>(
      "/wallet/getWalletPositions",
      request,
    );
  }

  getUserLiquidityPositions(
    request: GetUserLiquidityPositionsRequest,
  ): Promise<GetUserLiquidityPositionsResponse> {
    return this.post<
      GetUserLiquidityPositionsRequest,
      GetUserLiquidityPositionsResponse
    >("/wallet/getUserLiquidityPositions", request);
  }

  // CreateTransaction methods
  swapTokens(request: SwapTokensRequest): Promise<SwapTokensResponse> {
    return this.post<SwapTokensRequest, SwapTokensResponse>(
      "/transaction/swapTokens",
      request,
    );
  }

  borrowTokens(request: BorrowTokensRequest): Promise<BorrowTokensResponse> {
    return this.post<BorrowTokensRequest, BorrowTokensResponse>(
      "/transaction/borrowTokens",
      request,
    );
  }

  repayTokens(request: RepayTokensRequest): Promise<RepayTokensResponse> {
    return this.post<RepayTokensRequest, RepayTokensResponse>(
      "/transaction/repayTokens",
      request,
    );
  }

  supplyTokens(request: SupplyTokensRequest): Promise<SupplyTokensResponse> {
    return this.post<SupplyTokensRequest, SupplyTokensResponse>(
      "/transaction/supplyTokens",
      request,
    );
  }

  withdrawTokens(
    request: WithdrawTokensRequest,
  ): Promise<WithdrawTokensResponse> {
    return this.post<WithdrawTokensRequest, WithdrawTokensResponse>(
      "/transaction/withdrawTokens",
      request,
    );
  }

  supplyLiquidity(
    request: SupplyLiquidityRequest,
  ): Promise<SupplyLiquidityResponse> {
    return this.post<SupplyLiquidityRequest, SupplyLiquidityResponse>(
      "/transaction/supplyLiquidity",
      request,
    );
  }

  withdrawLiquidity(
    request: WithdrawLiquidityRequest,
  ): Promise<WithdrawLiquidityResponse> {
    return this.post<WithdrawLiquidityRequest, WithdrawLiquidityResponse>(
      "/transaction/withdrawLiquidity",
      request,
    );
  }

  getLiquidityPools(): Promise<GetLiquidityPoolsResponse> {
    // Empty body request
    return this.post<object, GetLiquidityPoolsResponse>(
      "/transaction/getLiquidityPools",
      {},
    );
  }

  // TransactionExecution method
  getProviderTrackingStatus(
    request: GetProviderTrackingStatusRequest,
  ): Promise<GetProviderTrackingStatusResponse> {
    return this.post<
      GetProviderTrackingStatusRequest,
      GetProviderTrackingStatusResponse
    >("/transactionExecution/getProviderTrackingStatus", request);
  }
}
