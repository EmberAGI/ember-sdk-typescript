/// <reference types="mocha" />
import { expect } from 'chai';
import { EmberClientConfig, EmberClient } from '@emberai/sdk-typescript';
import EmberGrpcClient from '@emberai/sdk-typescript';
import { 
  ProviderStatus, 
  GetProviderTrackingStatusRequest, 
  GetProviderTrackingStatusResponse,
  GetChainsRequest,
  GetChainsResponse,
  GetTokensRequest,
  GetTokensResponse,
  SwapTokensRequest,
  SwapTokensResponse,
} from '@emberai/sdk-typescript';
import { TEST_CONSTANTS } from './fixtures/constants';
import { MockEmberClient, StatusVariantMockEmberClient, ErrorMockEmberClient } from './mocks/mock-clients';
import { assertValidTrackingStatus, assertErrorThrown } from './helpers/shared-assertions';


// ---------------------
// Test Suites
// ---------------------

describe('Integration tests for getProviderTrackingStatus', function () {
  this.timeout(10000);

  // ---------------------
  // Live Client Tests
  // These tests run only if TEST_ENV is set to "live"
  // ---------------------
  describe('Live Client Tests', function () {
    let client: EmberClient;

    before(function () {
      if (process.env.TEST_ENV !== 'live') {
        this.skip();
      }
      const config: EmberClientConfig = {
        endpoint: process.env.EMBER_ENDPOINT || 'grpc.api.emberai.xyz:50051',
      };
      client = new EmberGrpcClient(config);
    });

    after(() => {
      if (client && client.close) client.close();
    });

    it('should successfully return tracking status for a valid transaction', async () => {
      const response = await client.getProviderTrackingStatus({
        requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID,
        transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID,
      });
      expect(response.trackingStatus, 'trackingStatus should exist').to.exist;
      expect(response.trackingStatus!.providerName).to.exist;
      expect(response.trackingStatus!.requestId).to.equal(TEST_CONSTANTS.SUCCESS_REQUEST_ID);
      expect(response.trackingStatus!.transactionId).to.equal(TEST_CONSTANTS.SUCCESS_TRANSACTION_ID);
      expect(response.trackingStatus!.status).to.equal(ProviderStatus.PROVIDER_STATUS_SUCCESS);
    });

    describe('Invalid Argument Tests (Live)', function () {
      it('should handle empty requestId', async () => {
        await assertErrorThrown(
          client,
          { requestId: '', transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID },
          'INVALID_ARGUMENT'
        );
      });
      
      it('should handle empty transactionId', async () => {
        await assertErrorThrown(
          client,
          { requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID, transactionId: '' },
          'INVALID_ARGUMENT'
        );
      });
      
      it('should handle both requestId and transactionId empty', async () => {
        await assertErrorThrown(
          client,
          { requestId: '', transactionId: '' },
          'INVALID_ARGUMENT'
        );
      });
    });
  });

  // ---------------------
  // Mock Client Tests
  // These tests always run
  // ---------------------
  describe('Mock Client Tests', function () {
    let client: EmberClient;

    before(() => {
      client = new MockEmberClient();
    });

    after(() => {
      if (client && client.close) client.close();
    });

    it('should successfully return tracking status for a valid transaction (mock)', async () => {
      const response = await client.getProviderTrackingStatus({
        requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID,
        transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID,
      });
      expect(response.trackingStatus, 'trackingStatus should exist').to.exist;
      expect(response.trackingStatus!.providerName).to.equal('MockProvider');
      expect(response.trackingStatus!.requestId).to.equal(TEST_CONSTANTS.SUCCESS_REQUEST_ID);
      expect(response.trackingStatus!.transactionId).to.equal(TEST_CONSTANTS.SUCCESS_TRANSACTION_ID);
      expect(response.trackingStatus!.status).to.equal(ProviderStatus.PROVIDER_STATUS_SUCCESS);
    });

    describe('Invalid Argument Tests (Mock)', function () {
      it('should handle empty requestId', async () => {
        const invalidClient = new ErrorMockEmberClient('INVALID_ARGUMENT');
        await assertErrorThrown(
          invalidClient,
          { requestId: '', transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID },
          'INVALID_ARGUMENT',
          'Missing or invalid parameters'
        );
      });
      
      it('should handle empty transactionId', async () => {
        const invalidClient = new ErrorMockEmberClient('INVALID_ARGUMENT');
        await assertErrorThrown(
          invalidClient,
          { requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID, transactionId: '' },
          'INVALID_ARGUMENT',
          'Missing or invalid parameters'
        );
      });
      
      it('should handle both requestId and transactionId empty', async () => {
        const invalidClient = new ErrorMockEmberClient('INVALID_ARGUMENT');
        await assertErrorThrown(
          invalidClient,
          { requestId: '', transactionId: '' },
          'INVALID_ARGUMENT',
          'Missing or invalid parameters'
        );
      });
    });

    describe('Success Variant Tests', function () {
      it('should handle PARTIAL_SUCCESS status', async () => {
        const variantClient = new StatusVariantMockEmberClient(ProviderStatus.PROVIDER_STATUS_PARTIAL_SUCCESS);
        const response = await variantClient.getProviderTrackingStatus({
          requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID,
          transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID,
        });
        expect(response.trackingStatus).to.exist;
        expect(response.trackingStatus!.status).to.equal(ProviderStatus.PROVIDER_STATUS_PARTIAL_SUCCESS);
      });

      it('should handle NEEDS_GAS status', async () => {
        const variantClient = new StatusVariantMockEmberClient(ProviderStatus.PROVIDER_STATUS_NEEDS_GAS);
        const response = await variantClient.getProviderTrackingStatus({
          requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID,
          transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID,
        });
        expect(response.trackingStatus).to.exist;
        expect(response.trackingStatus!.status).to.equal(ProviderStatus.PROVIDER_STATUS_NEEDS_GAS);
      });

      it('should handle ONGOING status', async () => {
        const variantClient = new StatusVariantMockEmberClient(ProviderStatus.PROVIDER_STATUS_ONGOING);
        const response = await variantClient.getProviderTrackingStatus({
          requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID,
          transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID,
        });
        expect(response.trackingStatus).to.exist;
        expect(response.trackingStatus!.status).to.equal(ProviderStatus.PROVIDER_STATUS_ONGOING);
      });
    });

    describe('Error Scenario Tests', function () {
      it('should handle NOT_FOUND error', async () => {
        const errorClient = new ErrorMockEmberClient('NOT_FOUND');
        await assertErrorThrown(
          errorClient,
          { requestId: 'nonexistent', transactionId: 'nonexistent' },
          'NOT_FOUND'
        );
      });

      it('should handle INTERNAL error', async () => {
        const errorClient = new ErrorMockEmberClient('INTERNAL');
        await assertErrorThrown(
          errorClient,
          { 
            requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID,
            transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID 
          },
          'INTERNAL'
        );
      });

      it('should validate response structure', async () => {
        const response = await client.getProviderTrackingStatus({
          requestId: TEST_CONSTANTS.SUCCESS_REQUEST_ID,
          transactionId: TEST_CONSTANTS.SUCCESS_TRANSACTION_ID,
        });
        assertValidTrackingStatus(response);
      });
    });
  });
}); 