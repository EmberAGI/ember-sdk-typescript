import { ethers } from "ethers";

export async function mintUSDC({
  provider,
  tokenAddress,
  userAddress,
  balanceStr,
}: {
  provider: ethers.providers.JsonRpcProvider;
  tokenAddress: string;
  userAddress: string;
  balanceStr: string;
}): Promise<void> {
  const newBalance = ethers.BigNumber.from(balanceStr);
  // For USDC, the balance mapping is known to be stored at slot 9.
  const mappingSlot = 9;

  // Calculate the storage slot for the given user.
  // The storage slot for a mapping is computed as keccak256(abi.encode(key, mappingSlot))
  const storageSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [userAddress, mappingSlot],
    ),
  );

  // Prepare the new balance as a 32-byte hex string.
  const newBalanceHex = ethers.utils.hexZeroPad(newBalance.toHexString(), 32);
  // Use Anvil’s cheatcode to set storage.
  await provider.send("anvil_setStorageAt", [
    tokenAddress,
    storageSlot,
    newBalanceHex,
  ]);
  await provider.send("evm_mine", []);
}
