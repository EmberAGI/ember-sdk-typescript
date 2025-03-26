import { ethers } from "ethers";

const WETH_ABI = [
  "function deposit() external payable",
  "function balanceOf(address owner) external view returns (uint256)",
];

export async function wrapEth(
  signer: ethers.Signer,
  amountInEth: string,
  wethAddress: string,
): Promise<ethers.ContractTransaction> {
  const weth = new ethers.Contract(wethAddress, WETH_ABI, signer);
  const tx = await weth.deposit({
    value: ethers.utils.parseEther(amountInEth),
  });
  await tx.wait();
  return tx;
}

export async function ensureWethBalance(
  signer: ethers.Signer,
  requiredAmount: string,
  wethAddress: string,
): Promise<void> {
  const weth = new ethers.Contract(wethAddress, WETH_ABI, signer);
  const address = await signer.getAddress();
  const balance = await weth.balanceOf(address);
  const requiredAmountBN = ethers.utils.parseEther(requiredAmount);
  if (balance.lt(requiredAmountBN)) {
    const difference = requiredAmountBN.sub(balance);
    const tx = await weth.deposit({ value: difference });
    await tx.wait();
  }
}
