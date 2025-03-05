/// <reference types="mocha" />
import { expect } from 'chai';
import { definePool, Pool, Instance } from 'prool';
import { anvil } from 'prool/instances';
import { ethers } from 'ethers';
import { ENVIRONMENT } from './helpers/settings';
import {
  EmberClient,
} from "@emberai/sdk-typescript";

describe('Integration tests for AAVE', function () {
  let pool: Pool;
  let provider: ethers.providers.JsonRpcProvider;
  let instance: Instance;
  let emberClient: EmberClient;
  this.beforeAll(async () => {
    pool = definePool({
      instance: anvil({
        chainId: 1,
        mnemonicRandom: true,
        forkUrl: ENVIRONMENT.ETH_RPC_URL,
      }),
    })

    instance = await pool.start(1) as Instance;
    const rpcUrl = `http://${instance.host}:${instance.port}`;
    console.log('instant', instance, rpcUrl);
    // available at http://localhost:8545/1
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  });

  this.afterAll(async () => {
    await pool.stopAll();
  });

  it('should successfully return tracking status for a valid transaction', async () => {
    const blockNumber = await provider.getBlockNumber();
    console.log('Latest Block Number:', blockNumber);
    expect(blockNumber).to.be.a('number');
  });
});
