import {
  EmberClient,
  GetChainsRequest,
  GetChainsResponse,
  GetTokensRequest,
  GetTokensResponse,
  SwapTokensRequest,
  SwapTokensResponse,
  GetProviderTrackingStatusRequest,
  GetProviderTrackingStatusResponse,
  ProviderStatus,
} from "@emberai/sdk-typescript";

// Base mock class with common unimplemented methods
abstract class BaseEmberMockClient implements EmberClient {
  async getChains(_request: GetChainsRequest): Promise<GetChainsResponse> {
    throw new Error("Not implemented in mock");
  }
  async getTokens(_request: GetTokensRequest): Promise<GetTokensResponse> {
    throw new Error("Not implemented in mock");
  }
  async swapTokens(_request: SwapTokensRequest): Promise<SwapTokensResponse> {
    throw new Error("Not implemented in mock");
  }
  abstract getProviderTrackingStatus(
    request: GetProviderTrackingStatusRequest,
  ): Promise<GetProviderTrackingStatusResponse>;
  close(): void {}
}

// Basic mock that returns a success response
export class MockEmberClient extends BaseEmberMockClient {
  async getProviderTrackingStatus(
    request: GetProviderTrackingStatusRequest,
  ): Promise<GetProviderTrackingStatusResponse> {
    return {
      trackingStatus: {
        requestId: request.requestId,
        transactionId: request.transactionId,
        providerName: "MockProvider",
        explorerUrl: `http://mockexplorer.com/tx/${request.transactionId}`,
        status: ProviderStatus.PROVIDER_STATUS_SUCCESS,
      },
    };
  }
}

// Mock that allows returning different statuses
export class StatusVariantMockEmberClient extends BaseEmberMockClient {
  private status: ProviderStatus;
  constructor(status: ProviderStatus) {
    super();
    this.status = status;
  }
  async getProviderTrackingStatus(
    request: GetProviderTrackingStatusRequest,
  ): Promise<GetProviderTrackingStatusResponse> {
    return {
      trackingStatus: {
        requestId: request.requestId,
        transactionId: request.transactionId,
        providerName: "MockProvider",
        explorerUrl: `http://mockexplorer.com/tx/${request.transactionId}`,
        status: this.status,
      },
    };
  }
}

// Mock designed to simulate error conditions
export class ErrorMockEmberClient extends BaseEmberMockClient {
  private errorType: string;
  constructor(errorType: string) {
    super();
    this.errorType = errorType;
  }
  async getProviderTrackingStatus(
    _request: GetProviderTrackingStatusRequest,
  ): Promise<GetProviderTrackingStatusResponse> {
    switch (this.errorType) {
      case "NOT_FOUND":
        throw new Error("NOT_FOUND: Transaction not found");
      case "INTERNAL":
        throw new Error("INTERNAL: Internal server error occurred");
      case "INVALID_ARGUMENT":
        throw new Error("INVALID_ARGUMENT: Missing or invalid parameters");
      default:
        throw new Error("UNKNOWN: An unexpected error occurred");
    }
  }
}
