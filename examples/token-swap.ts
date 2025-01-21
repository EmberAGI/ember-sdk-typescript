import EmberClient, { OrderType } from '../src/index.js';

async function main() {
  // Initialize the client
  const client = new EmberClient({
    endpoint: 'api.emberai.xyz:443',
    apiKey: process.env.EMBER_API_KEY,
  });

  try {
    // Get supported chains
    const { chains } = await client.getChains({
      pageSize: 10,
      filter: '',
      pageToken: '',
    });
    
    // Find Ethereum chain
    const ethereum = chains.find(chain => chain.name.toLowerCase() === 'ethereum');
    if (!ethereum) {
      throw new Error('Ethereum chain not found');
    }

    // Get tokens on Ethereum
    const { tokens } = await client.getTokens({
      chainId: ethereum.chainId,
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
      type: OrderType.MARKET_BUY,
      baseToken: {
        chainId: ethereum.chainId,
        tokenId: weth.tokenId,
      },
      quoteToken: {
        chainId: ethereum.chainId,
        tokenId: usdc.tokenId,
      },
      // Amount in smallest unit (1 WETH = 1e18 wei)
      amount: '1000000000000000000',
      // Your wallet address
      recipient: process.env.WALLET_ADDRESS || '0x...',
    });

    console.log('Swap created:', {
      status: swap.status,
      baseTokenDelta: swap.estimation?.baseTokenDelta,
      quoteTokenDelta: swap.estimation?.quoteTokenDelta,
      effectivePrice: swap.estimation?.effectivePrice,
      fees: swap.feeBreakdown,
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always close the client when done
    client.close();
  }
}

main(); 