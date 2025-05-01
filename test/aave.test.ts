/// <reference types="mocha" />
import { expect } from "chai";
import "dotenv/config";
import {
  EmberClient,
  EmberGrpcClient,
  GetWalletPositionsResponse,
} from "@emberai/sdk-typescript";
import { Agent } from "../examples/aave-agent/agent";
import { ensureWethBalance } from "./helpers/weth";
import { CHAIN_CONFIGS } from "./chains";
import { MultiChainSigner } from "./multichain-signer";

// Define chain IDs that should be tested
// Using available chains from the test environment
const CHAINS_TO_TEST: number[] = [42161]; // Base and Arbitrum One

describe("Integration tests for AAVE", async function () {
  this.timeout(50_000);

  let multiChainSigner: MultiChainSigner;
  let client: EmberClient;

  const emberEndpoint = process.env.TEST_EMBER_ENDPOINT;
  if (!emberEndpoint) {
    throw new Error("TEST_EMBER_ENDPOINT not found in the environment.");
  }

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC not found in the environment.");
  }

  before(async function() {
    try {
      // Create a single MultiChainSigner for all chains being tested
      multiChainSigner = await MultiChainSigner.fromTestChains(CHAINS_TO_TEST);
      
      // Initialize Ember client
      client = new EmberGrpcClient(emberEndpoint);
    } catch (error) {
      console.error("Failed to initialize test environment:", error);
      throw error;
    }
  });

  // Create a separate test suite for each chain
  for (const chainId of CHAINS_TO_TEST) {
    describe(`Running tests on ${CHAIN_CONFIGS[chainId]?.name || `Chain ${chainId}`}`, function() {
      let agent: Agent;

      // Get wallet lending positions for current chain
      const getReserveOfToken = async (name: string) => {
        const positionsResponse = (await client.getWalletPositions({
          walletAddress: multiChainSigner.wallet.address,
        })) as GetWalletPositionsResponse;

        for (const position of positionsResponse.positions) {
          if (!position.lendingPosition) continue;
          for (const reserve of position.lendingPosition.userReserves) {
            if (reserve.token?.name == name || reserve.token?.symbol == name) {
              return reserve;
            }
          }
        }

        return null;
      };

      before(async function() {
        // Verify that chain configuration exists
        if (!CHAIN_CONFIGS[chainId]) {
          throw new Error(`Chain configuration missing for chain ID ${chainId}. Please add it to test/chains.ts.`);
        }
        
        // Get WETH address from chain config
        const wethAddress = CHAIN_CONFIGS[chainId]?.wrappedNativeToken?.address;
        if (!wethAddress) {
          throw new Error(`No wrapped native token (WETH) defined for chain ${chainId}. Please add wrappedNativeToken to the chain configuration in test/chains.ts.`);
        }
        
        // Create agent for this chain
        agent = new Agent(client, multiChainSigner);
        
        // Mute logs
        agent.log = async () => {};
        
        // Initialize agent
        await agent.init();
        
        // Ensure WETH balance
        const signer = multiChainSigner.getSignerForChainId(chainId);
        await ensureWethBalance(signer, "1", wethAddress);
      });

      after(async function() {
        if (agent) {
          await agent.stop();
        }
      });

      it("should be able to describe what it can do", async () => {
        const response = await agent.processUserInput("What can you do?");
        expect(response.content.toLowerCase()).to.contain("borrow");
      });

      it("supply some WETH", async () => {
        const amountToSupply = "0.01";

        // Get original balance
        const oldReserve = await getReserveOfToken("WETH");
        if (!oldReserve) {
          throw new Error("WETH reserve not found");
        }

        // supply some WETH
        const response = await agent.processUserInput(
          `supply ${amountToSupply} Wrapped ETH`,
        );
        expect(response.function_call!.name).to.be.equal("supply");
        expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
          tokenName: "Wrapped ETH",
          amount: amountToSupply,
        });

        // Check the new balance increased
        const newReserve = await getReserveOfToken("WETH");
        if (!newReserve) {
          throw new Error("WETH reserve not found after supply");
        }
        expect(parseFloat(oldReserve.underlyingBalance)).to.be.closeTo(
          parseFloat(newReserve.underlyingBalance) - parseFloat(amountToSupply),
          0.00001,
        );
      });

      // Depends on the above test for collateral
      it("borrow some WETH", async () => {
        const amountToBorrow = "0.005";

        // Get original balance
        const oldReserve = await getReserveOfToken("WETH");
        if (!oldReserve) {
          throw new Error("WETH reserve not found");
        }

        // Borrow some WETH
        const response = await agent.processUserInput(
          `borrow ${amountToBorrow} Wrapped ETH`,
        );
        expect(response.function_call!.name).to.be.equal("borrow");
        expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
          tokenName: "Wrapped ETH",
          amount: amountToBorrow,
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Check the new borrow amount increase
        const newReserve = await getReserveOfToken("WETH");
        if (!newReserve) {
          throw new Error("WETH reserve not found after borrow");
        }
        expect(parseFloat(oldReserve.totalBorrows)).to.be.closeTo(
          parseFloat(newReserve.totalBorrows) - parseFloat(amountToBorrow),
          0.000001,
        );
      });

      it("show my positions", async () => {
        // Just to make sure there are no exceptions
        await agent.processUserInput(`show my positions`);
      });

      // Depends on the above test (the loan must exist)
      it("repay some WETH", async () => {
        const amountToRepay = "0.005";

        // Get original balance
        const oldReserve = await getReserveOfToken("WETH");
        if (!oldReserve) {
          throw new Error("WETH reserve not found");
        }

        const response = await agent.processUserInput(
          `repay ${amountToRepay} Wrapped ETH`,
        );
        expect(response.function_call!.name).to.be.equal("repay");
        expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
          tokenName: "Wrapped ETH",
          amount: amountToRepay,
        });

        // Check the new borrow amount decrease
        const newReserve = await getReserveOfToken("WETH");
        if (!newReserve) {
          throw new Error("WETH reserve not found after repay");
        }
        expect(parseFloat(oldReserve.totalBorrows)).to.be.closeTo(
          parseFloat(newReserve.totalBorrows) + parseFloat(amountToRepay),
          0.000001,
        );
      });

      // Depends on the above test (the deposit must exist)
      it("withdraw some WETH", async () => {
        const amountToWithdraw = "0.004";

        // Get original balance
        const oldReserve = await getReserveOfToken("WETH");
        if (!oldReserve) {
          throw new Error("WETH reserve not found");
        }

        const response = await agent.processUserInput(
          `withdraw ${amountToWithdraw} Wrapped ETH`,
        );
        expect(response.function_call!.name).to.be.equal("withdraw");
        expect(JSON.parse(response.function_call!.arguments)).to.be.deep.equal({
          tokenName: "Wrapped ETH",
          amount: amountToWithdraw,
        });

        // Check the new balance amount decrease
        const newReserve = await getReserveOfToken("WETH");
        if (!newReserve) {
          throw new Error("WETH reserve not found after withdraw");
        }
        expect(parseFloat(oldReserve.underlyingBalance)).to.be.closeTo(
          parseFloat(newReserve.underlyingBalance) + parseFloat(amountToWithdraw),
          0.000001,
        );
      });
    });
  }
});
