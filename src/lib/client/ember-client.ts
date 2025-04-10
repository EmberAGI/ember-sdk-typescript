import {
  credentials,
  ClientOptions,
  ServiceError,
  Metadata,
  CallOptions,
} from "@grpc/grpc-js";
import {
  DataServiceClient,
  WalletContextClient,
  CreateTransactionClient,
  TransactionExecutionClient,
  // DataService types
  GetChainsRequest,
  GetChainsResponse,
  GetTokensRequest,
  GetTokensResponse,
  GetCapabilitiesRequest,
  GetCapabilitiesResponse,
  // WalletContext types
  GetWalletPositionsRequest,
  GetWalletPositionsResponse,
  GetUserLiquidityPositionsRequest,
  GetUserLiquidityPositionsResponse,
  // CreateTransaction types
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
  // TransactionExecution types
  GetProviderTrackingStatusRequest,
  GetProviderTrackingStatusResponse,
  // DynamicAPI types
  DynamicAPIClient,
  RefinePayloadRequest,
  RefinePayloadResponse,
} from "../../generated/onchain-actions/onchain_actions.js";
import { EmberClient } from "../types/client.js";

export class EmberGrpcClient implements EmberClient {
  private dataServiceClient: DataServiceClient;
  private walletContextClient: WalletContextClient;
  private createTransactionClient: CreateTransactionClient;
  private transactionExecutionClient: TransactionExecutionClient;
  private dynamicAPIClient: DynamicAPIClient;

  constructor(address: string, options?: Partial<ClientOptions>) {
    // For simplicity we use insecure credentials.
    const creds = credentials.createInsecure();
    this.dataServiceClient = new DataServiceClient(address, creds, options);
    this.walletContextClient = new WalletContextClient(address, creds, options);
    this.createTransactionClient = new CreateTransactionClient(
      address,
      creds,
      options,
    );
    this.transactionExecutionClient = new TransactionExecutionClient(
      address,
      creds,
      options,
    );
    this.dynamicAPIClient = new DynamicAPIClient(address, creds, options);
  }

  public close(): void {
    this.dataServiceClient.close();
    this.walletContextClient.close();
    this.createTransactionClient.close();
    this.transactionExecutionClient.close();
  }

  // DataService methods
  getChains(
    request: GetChainsRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<GetChainsResponse> {
    return new Promise((resolve, reject) => {
      this.dataServiceClient.getChains(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: GetChainsResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  getTokens(
    request: GetTokensRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<GetTokensResponse> {
    return new Promise((resolve, reject) => {
      this.dataServiceClient.getTokens(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: GetTokensResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  getCapabilities(
    request: GetCapabilitiesRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<GetCapabilitiesResponse> {
    return new Promise((resolve, reject) => {
      this.dataServiceClient.getCapabilities(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: GetCapabilitiesResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  // WalletContext method
  getWalletPositions(
    request: GetWalletPositionsRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<GetWalletPositionsResponse> {
    return new Promise((resolve, reject) => {
      this.walletContextClient.getWalletPositions(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: GetWalletPositionsResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  getUserLiquidityPositions(
    request: GetUserLiquidityPositionsRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<GetUserLiquidityPositionsResponse> {
    return new Promise((resolve, reject) => {
      this.walletContextClient.getUserLiquidityPositions(
        request,
        metadata,
        options || {},
        (
          err: ServiceError | null,
          response?: GetUserLiquidityPositionsResponse,
        ) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  // CreateTransaction methods
  swapTokens(
    request: SwapTokensRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<SwapTokensResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.swapTokens(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: SwapTokensResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  borrowTokens(
    request: BorrowTokensRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<BorrowTokensResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.borrowTokens(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: BorrowTokensResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  repayTokens(
    request: RepayTokensRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<RepayTokensResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.repayTokens(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: RepayTokensResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  supplyTokens(
    request: SupplyTokensRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<SupplyTokensResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.supplyTokens(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: SupplyTokensResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  withdrawTokens(
    request: WithdrawTokensRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<WithdrawTokensResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.withdrawTokens(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: WithdrawTokensResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  supplyLiquidity(
    request: SupplyLiquidityRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<SupplyLiquidityResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.supplyLiquidity(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: SupplyLiquidityResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  withdrawLiquidity(
    request: WithdrawLiquidityRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<WithdrawLiquidityResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.withdrawLiquidity(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: WithdrawLiquidityResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  getLiquidityPools(
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<GetLiquidityPoolsResponse> {
    return new Promise((resolve, reject) => {
      this.createTransactionClient.getLiquidityPools(
        {},
        metadata,
        options || {},
        (err: ServiceError | null, response?: GetLiquidityPoolsResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  // TransactionExecution method
  getProviderTrackingStatus(
    request: GetProviderTrackingStatusRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<GetProviderTrackingStatusResponse> {
    return new Promise((resolve, reject) => {
      this.transactionExecutionClient.getProviderTrackingStatus(
        request,
        metadata,
        options || {},
        (
          err: ServiceError | null,
          response?: GetProviderTrackingStatusResponse,
        ) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  // Dynamic API methods
  refinePayload(
    request: RefinePayloadRequest,
    metadata: Metadata = new Metadata(),
    options?: Partial<CallOptions>,
  ): Promise<RefinePayloadResponse> {
    return new Promise((resolve, reject) => {
      this.dynamicAPIClient.refinePayload(
        request,
        metadata,
        options || {},
        (err: ServiceError | null, response?: RefinePayloadResponse) => {
          if (err || !response) {
            reject(err);
          } else {
            resolve(response);
          }
        },
      );
    });
  }
}
