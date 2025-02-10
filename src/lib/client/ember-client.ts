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
} from '../../generated/onchain_actions.js';
import type { EmberClient, EmberClientConfig } from '../types/client.js';

export class EmberGrpcClient implements EmberClient {
  private readonly dataClient: DataServiceClient;
  private readonly transactionClient: CreateTransactionClient;
  private readonly executionClient: TransactionExecutionClient;
  private readonly metadata: grpc.Metadata;

  constructor(config: EmberClientConfig) {
    const credentials = grpc.credentials.createInsecure(); // TODO: Add SSL support
    
    this.dataClient = new DataServiceClient(config.endpoint, credentials);
    this.transactionClient = new CreateTransactionClient(config.endpoint, credentials);
    this.executionClient = new TransactionExecutionClient(config.endpoint, credentials);
    
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

  close(): void {
    this.dataClient.close();
    this.transactionClient.close();
    this.executionClient.close();
  }
} 