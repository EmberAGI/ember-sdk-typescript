import { expect } from "chai";
import {
  GetProviderTrackingStatusResponse,
  EmberClient,
} from "@emberai/sdk-typescript";

export const assertValidTrackingStatus = (
  response: GetProviderTrackingStatusResponse,
) => {
  expect(response).to.have.property("trackingStatus");
  if (response.trackingStatus) {
    expect(response.trackingStatus).to.have.all.keys([
      "requestId",
      "transactionId",
      "providerName",
      "explorerUrl",
      "status",
    ]);
    expect(response.trackingStatus.explorerUrl).to.be.a("string");
  }
};

export const assertErrorThrown = async (
  client: EmberClient,
  params: { requestId: string; transactionId: string },
  expectedError: string,
  additionalErrorMessage?: string,
) => {
  try {
    await client.getProviderTrackingStatus(params);
    throw new Error("Expected error was not thrown");
  } catch (error) {
    expect((error as Error).message).to.include(expectedError);
    if (additionalErrorMessage) {
      expect((error as Error).message).to.include(additionalErrorMessage);
    }
  }
};
