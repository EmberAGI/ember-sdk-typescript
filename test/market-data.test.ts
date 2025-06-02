/// <reference types="mocha" />
import { expect } from "chai";
import "dotenv/config";
import { EmberClient, EmberGrpcClient } from "../src/index.js";

describe("Integration tests for Market Data", async function () {
  this.timeout(30_000);

  let client: EmberClient;

  const emberEndpoint = process.env.TEST_EMBER_ENDPOINT;
  if (!emberEndpoint) {
    throw new Error("TEST_EMBER_ENDPOINT not found in the environment.");
  }

  before(async function () {
    try {
      client = new EmberGrpcClient(emberEndpoint);
    } catch (error) {
      console.error("Failed to initialize test environment:", error);
      throw error;
    }
  });

  after(async function () {
    if (client) {
      client.close();
    }
  });

  it("should get market data for a token on Arbitrum One", async () => {
    // Test with the specified USDC token on Arbitrum One
    const response = await client.getMarketData({
      tokenUid: {
        chainId: "42161", // Arbitrum One
        address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      },
    });

    expect(response).to.have.property("price");
    expect(response).to.have.property("marketCap");
    expect(response).to.have.property("volume24h");
    expect(response).to.have.property("priceChange24h");
  });
});
