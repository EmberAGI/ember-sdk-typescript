import EmberClient, { OrderType, TransactionType } from '../src/index.js';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

async function main() {
  // Initialize the client
  const client = new EmberClient({
    endpoint: 'grpc.api.emberai.xyz:50051',
    apiKey: process.env.EMBER_API_KEY,
  });

  // Initialize Ethereum clients
  const transport = http(process.env.RPC_URL || 'https://eth.llamarpc.com');
  const publicClient = createPublicClient({
    chain: mainnet,
    transport,
  });

  // Create wallet from private key
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport,
  });

  try {
    // Get tokens on Ethereum
    const { tokens } = await client.getTokens({
      chainId: '1', // Ethereum
      pageSize: 100,
      filter: '',
      pageToken: '',
    });

    // Find USDC and WETH tokens
    const usdc = tokens.find(token => token.symbol === 'USDC');
    const weth = tokens.find(token => token.symbol === 'WETH');

    if (!usdc || !weth) {
      throw new Error('Required tokens not found');
    }

    // Create a swap request to buy 1 WETH with USDC
    const swap = await client.swapTokens({
      orderType: OrderType.MARKET_BUY,
      baseToken: {
        chainId: '1', // Ethereum
        address: weth.tokenId,
      },
      quoteToken: {
        chainId: '1', // Ethereum
        address: usdc.tokenId,
      },
      // Amount in smallest unit (1 WETH = 1e18 wei)
      amount: '1000000000000000000',
      // Your wallet address
      recipient: account.address,
    });

    console.log('Swap created:', {
      status: swap.status,
      baseTokenDelta: swap.estimation?.baseTokenDelta,
      quoteTokenDelta: swap.estimation?.quoteTokenDelta,
      effectivePrice: swap.estimation?.effectivePrice,
      fees: swap.feeBreakdown,
    });

    // Check if we have a valid transaction plan
    if (!swap.transactionPlan) {
      throw new Error('No transaction plan received');
    }

    // Verify this is an EVM transaction
    if (swap.transactionPlan.type !== TransactionType.EVM_TX) {
      throw new Error('Expected EVM transaction');
    }

    // Get the latest gas estimate
    const gasEstimate = await publicClient.estimateGas({
      account: account.address,
      to: swap.transactionPlan.to as `0x${string}`,
      data: swap.transactionPlan.data as `0x${string}`,
      value: BigInt(swap.transactionPlan.value || '0'),
    });

    // Send the transaction
    const hash = await walletClient.sendTransaction({
      to: swap.transactionPlan.to as `0x${string}`,
      data: swap.transactionPlan.data as `0x${string}`,
      value: BigInt(swap.transactionPlan.value || '0'),
      gas: gasEstimate,
    });
    
    console.log('Transaction sent:', { hash });

    // Create a clickable transaction link using provider tracking info
    if (swap.providerTracking?.explorerUrl) {
      const txLink = `${swap.providerTracking.explorerUrl}${hash}`;
      console.log('View provider transaction status:', txLink);
    }

    // Wait for the transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Transaction confirmed:', {
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 'success' ? 'success' : 'failed',
    });

    // Integrate provider tracking: use the existing swap's requestId and the transaction hash as transactionId
    const requestId = swap.providerTracking?.requestId;
    if (requestId) {
      const trackingStatus = await client.getProviderTrackingStatus({
        requestId,
        transactionId: hash,
      });
      console.log('Provider Tracking Status:', trackingStatus);
    } else {
      console.log('No requestId available for provider tracking.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always close the client when done
    client.close();
  }
}

main(); 