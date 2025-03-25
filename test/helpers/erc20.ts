import { ethers, Contract, providers, BigNumber } from "ethers";

// Minimal ERC20 ABI
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export class ERC20Wrapper {
  provider: providers.Provider;
  contract: Contract;

  /**
   * Constructs a new ERC20Wrapper instance.
   * @param provider - An ethers.js provider.
   * @param contractAddress - The ERC20 contract address.
   */
  constructor(provider: providers.Provider, contractAddress: string) {
    this.provider = provider;
    this.contract = new Contract(contractAddress, ERC20_ABI, provider);
  }

  /**
   * Returns the token name.
   */
  async name(): Promise<string> {
    return await this.contract.name();
  }

  /**
   * Returns the token symbol.
   */
  async symbol(): Promise<string> {
    return await this.contract.symbol();
  }

  /**
   * Returns the token decimals.
   */
  async decimals(): Promise<number> {
    return await this.contract.decimals();
  }

  /**
   * Returns the total token supply.
   */
  async totalSupply(): Promise<BigNumber> {
    return await this.contract.totalSupply();
  }

  /**
   * Returns the token balance of a given address.
   * @param owner - The address to check.
   */
  async balanceOf(owner: string): Promise<BigNumber> {
    return await this.contract.balanceOf(owner);
  }

  /**
   * Transfers tokens to a specified address.
   * Note: This function requires a signer.
   * @param signer - An ethers.js Signer instance.
   * @param to - The recipient address.
   * @param amount - The amount to transfer (in the token’s smallest unit).
   */
  async transfer(
    signer: ethers.Signer,
    to: string,
    amount: BigNumber,
  ): Promise<ethers.ContractTransaction> {
    const contractWithSigner = this.contract.connect(signer);
    return await contractWithSigner.transfer(to, amount);
  }
}
