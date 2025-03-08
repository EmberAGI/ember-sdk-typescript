import * as grpc from '@grpc/grpc-js';
import {
  GetChainsRequest,
  GetChainsResponse,
  GetTokensRequest,
  GetTokensResponse,
  SwapTokensRequest,
  SwapTokensResponse,
  GetProviderTrackingStatusRequest,
  GetProviderTrackingStatusResponse,
  DataServiceClient,
  CreateTransactionClient,
  TransactionExecutionClient,
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
  WalletContextClient,
  GetCapabilitiesRequest,
  GetCapabilitiesResponse
} from '../../generated/onchain_actions.js';
import type { EmberClient, EmberClientConfig } from '../types/client.js';

export class EmberGrpcClient implements EmberClient {
  private readonly dataClient: DataServiceClient;
  private readonly walletContextClient: WalletContextClient;
  private readonly transactionClient: CreateTransactionClient;
  private readonly executionClient: TransactionExecutionClient;
  private readonly metadata: grpc.Metadata;

  constructor(config: EmberClientConfig) {
    const credentials = grpc.credentials.createInsecure(); // TODO: Add SSL support
    
    // Default gRPC options with 8MB message size limits
    const channelOptions: grpc.ChannelOptions = {
      'grpc.max_receive_message_length': 8 * 1024 * 1024, // 8MB
      'grpc.max_send_message_length': 8 * 1024 * 1024,    // 8MB
    };
    
    this.dataClient = new DataServiceClient(config.endpoint, credentials, channelOptions);
    this.walletContextClient = new WalletContextClient(config.endpoint, credentials, channelOptions);
    this.transactionClient = new CreateTransactionClient(config.endpoint, credentials, channelOptions);
    this.executionClient = new TransactionExecutionClient(config.endpoint, credentials, channelOptions);
    
    this.metadata = new grpc.Metadata();
    if (config.apiKey) {
      this.metadata.set('x-api-key', config.apiKey);
    }
  }

  async getChains(request: GetChainsRequest): Promise<GetChainsResponse> {
    return new Promise((resolve, reject) => {
      this.dataClient.getChains(
        request,
        this.metadata,
        (error: Error | null, response: GetChainsResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async getTokens(request: GetTokensRequest): Promise<GetTokensResponse> {
    return new Promise((resolve, reject) => {
      this.dataClient.getTokens(
        request,
        this.metadata,
        (error: Error | null, response: GetTokensResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async getCapabilities(request: GetCapabilitiesRequest): Promise<GetCapabilitiesResponse> {
    return new Promise((resolve, reject) => {
      this.dataClient.getCapabilities(
        request,
        this.metadata,
        (error: Error | null, response: GetCapabilitiesResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async swapTokens(request: SwapTokensRequest): Promise<SwapTokensResponse> {
    return new Promise((resolve, reject) => {
      this.transactionClient.swapTokens(
        request,
        this.metadata,
        (error: Error | null, response: SwapTokensResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async getProviderTrackingStatus(request: GetProviderTrackingStatusRequest): Promise<GetProviderTrackingStatusResponse> {
    return new Promise((resolve, reject) => {
      this.executionClient.getProviderTrackingStatus(
        request,
        this.metadata,
        (error: Error | null, response: GetProviderTrackingStatusResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async borrowTokens(request: BorrowTokensRequest): Promise<BorrowTokensResponse> {
    return new Promise((resolve, reject) => {
      this.transactionClient.borrowTokens(
        request,
        this.metadata,
        (error: Error | null, response: BorrowTokensResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async repayTokens(request: RepayTokensRequest): Promise<RepayTokensResponse> {
    return new Promise((resolve, reject) => {
      this.transactionClient.repayTokens(
        request,
        this.metadata,
        (error: Error | null, response: RepayTokensResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async supplyTokens(request: SupplyTokensRequest): Promise<SupplyTokensResponse> {
    return new Promise((resolve, reject) => {
      this.transactionClient.supplyTokens(
        request,
        this.metadata,
        (error: Error | null, response: SupplyTokensResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async withdrawTokens(request: WithdrawTokensRequest): Promise<WithdrawTokensResponse> {
    return new Promise((resolve, reject) => {
      this.transactionClient.withdrawTokens(
        request,
        this.metadata,
        (error: Error | null, response: WithdrawTokensResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  async getWalletPositions(request: GetWalletPositionsRequest): Promise<GetWalletPositionsResponse> {
    return new Promise((resolve, reject) => {
      this.walletContextClient.getWalletPositions(
        request,
        this.metadata,
        (error: Error | null, response: GetWalletPositionsResponse) => {
          if (error) reject(error);
          else resolve(response);
        }
      );
    });
  }

  close(): void {
    this.dataClient.close();
    this.transactionClient.close();
    this.executionClient.close();
  }
} 