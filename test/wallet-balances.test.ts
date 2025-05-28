/// <reference types="mocha" />
import { expect } from "chai";
import "dotenv/config";
import {
  EmberClient,
  EmberGrpcClient,
  GetWalletBalancesRequest,
  GetWalletBalancesResponse,
} from "@emberai/sdk-typescript";

describe("Wallet Balances Tests", function () {
  this.timeout(10_000);

  let client: EmberClient;

  const emberEndpoint = process.env.TEST_EMBER_ENDPOINT;
  if (!emberEndpoint) {
    throw new Error("TEST_EMBER_ENDPOINT not found in the environment.");
  }

  before(async function () {
    client = new EmberGrpcClient(emberEndpoint);
  });

  after(async function () {
    if (client) {
      client.close();
    }
  });

  it("should be able to call getWalletBalances with a valid wallet address", async function () {
    const testWalletAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const request: GetWalletBalancesRequest = {
      walletAddress: testWalletAddress,
    };
    const response: GetWalletBalancesResponse =
      await client.getWalletBalances(request);
    expect(response.balances.length).to.be.greaterThan(0);
  });

  it("should handle invalid wallet address gracefully", async function () {
    const request: GetWalletBalancesRequest = {
      walletAddress: "invalid-address",
    };

    try {
      await client.getWalletBalances(request);
    } catch (error) {
      expect(error).to.exist;
    }
  });
});
