import { ethers, Signer } from "ethers";
import { EmberClient, TransactionPlan } from "@emberai/sdk-typescript";
import {
  IDynamicAPIDispatcher,
  LendingToolParameters,
  DynamicApiAAVEAgent,
} from "./agent";
import chalk from "chalk";
import { match } from "ts-pattern";

export class DynamicAPIDispatcher implements IDynamicAPIDispatcher {
  constructor(
    private readonly client: EmberClient,
    private readonly signer: Signer,
  ) {}

  public async dispatch(
    agent: DynamicApiAAVEAgent,
    payload: LendingToolParameters,
  ): Promise<void> {
    agent.log("dispatch: payload", payload);
    const address = await this.signer.getAddress();
    const { token, chain } = await this.client.lookupToken({
      tokenName: payload.tokenName,
      chainName: payload.chainName,
    });
    agent.log("dispatch: token:", token);
    agent.log("dispatch: chain:", chain.name);
    const transactions: TransactionPlan[] = await match(payload)
      .with({ action: "supply" }, async (payload) => {
        return (
          await this.client.supplyTokens({
            tokenUid: token.tokenUid,
            amount: payload.amount,
            supplierWalletAddress: address,
          })
        ).transactions;
      })
      .with({ action: "borrow" }, async (payload) => {
        return (
          await this.client.borrowTokens({
            tokenUid: token.tokenUid,
            amount: payload.amount,
            borrowerWalletAddress: address,
          })
        ).transactions;
      })
      .with({ action: "repay" }, async (payload) => {
        return (
          await this.client.repayTokens({
            tokenUid: token.tokenUid,
            amount: payload.amount,
            borrowerWalletAddress: address,
          })
        ).transactions;
      })
      .with({ action: "withdraw" }, async (payload) => {
        return (
          await this.client.withdrawTokens({
            tokenUid: token.tokenUid,
            amount: payload.amount,
            lenderWalletAddress: address,
          })
        ).transactions;
      })
      .exhaustive();
    agent.log("dispatch: transactions", transactions);
    for (const transaction of transactions) {
      const txHash = await this.signAndSendTransaction(transaction);
      agent.log(chalk.redBright.bold("[transaction sent]:"), txHash);
    }
  }

  async signAndSendTransaction(tx: TransactionPlan): Promise<string> {
    const provider = this.signer.provider;
    const ethersTx: ethers.PopulatedTransaction = {
      to: tx.to,
      value: ethers.BigNumber.from(tx.value),
      data: tx.data,
      from: await this.signer.getAddress(),
    };
    await provider!.estimateGas(ethersTx);
    const txResponse = await this.signer.sendTransaction(ethersTx);
    await txResponse.wait();
    return txResponse.hash;
  }
}
