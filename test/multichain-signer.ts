import ethers from "ethers";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import { ChainConfig, CHAIN_CONFIGS } from "./chains";

export class MultiChainSigner {
  constructor(
    public readonly chains: Record<number, ChainConfig>,
    public readonly signers: Record<number, ethers.Signer>,
    public readonly wallet: ethers.Wallet,
  ) {}

  public getSignerForChainId(chainId: number): ethers.Signer {
    const address = this.signers[chainId];
    if (!address) {
      throw new Error(`No signer for chain ID ${chainId}`);
    }
    return address;
  }

  public getAddress(): Promise<string> {
    return this.wallet.getAddress();
  }

  public getChainConfig(chainId: number): ChainConfig {
    if (this.chains[chainId]) {
      return this.chains[chainId];
    } else {
      throw new Error(`MultiChainSigner.getChainConfig(${chainId}): no chain config for this ID`);
    }
  }

  public async sendTransaction(
    chainId: number,
    tx: ethers.PopulatedTransaction,
  ): Promise<TransactionResponse> {
    const signer = this.getSignerForChainId(chainId);
    return signer.sendTransaction(tx);
  }

  static async fromEnv(): Promise<MultiChainSigner> {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
      throw new Error("Mnemonic not found in the .env file.");
    }
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    console.log(`Using wallet ${wallet.address}`);
    return new MultiChainSigner(
      CHAIN_CONFIGS,
      await MultiChainSigner.loadSigners(wallet),
      wallet,
    );
  }

  private static async loadSigners(
    wallet: ethers.Wallet,
  ): Promise<Record<number, ethers.Signer>> {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(CHAIN_CONFIGS).map(([chainId, { rpcUrl }]) => {
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          const signer = wallet.connect(provider);
          return [chainId, signer];
        }),
      ),
    );
  }
}
