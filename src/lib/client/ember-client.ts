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
  // TransactionExecution types
  GetProviderTrackingStatusRequest,
  GetProviderTrackingStatusResponse,
} from "../../generated/onchain-actions/onchain_actions";

export class EmberGrpcClient {
  private dataServiceClient: DataServiceClient;
  private walletContextClient: WalletContextClient;
  private createTransactionClient: CreateTransactionClient;
  private transactionExecutionClient: TransactionExecutionClient;

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
}
