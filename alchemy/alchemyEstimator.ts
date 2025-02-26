import { ethers } from 'ethers'
import { Alchemy } from 'alchemy-sdk'
import type { EstimateGasData, UserOperation } from '@safe-global/types-kit';
import type { IFeeEstimator } from '@safe-global/relay-kit';

export type EstimateFeeFunctionProps = {
  userOperation: UserOperation
  bundlerUrl: string
  entryPoint: string
}

export class AlchemyFeeEstimator implements IFeeEstimator {
  #alchemySdk: Alchemy

  constructor(alchemySdk: Alchemy) {
    this.#alchemySdk = alchemySdk
  }

  async setupEstimation({ bundlerUrl, userOperation }: EstimateFeeFunctionProps): Promise<EstimateGasData> {
    const bundlerClient = new ethers.JsonRpcProvider(bundlerUrl, undefined, {
      batchMaxCount: 1
    })
    
    console.log(userOperation)

    const maxPriorityFeePerGas = await this.#getMaxPriorityFeePerGas(bundlerClient)
    const maxFeePerGas = await this.#getMaxFeePerGas(maxPriorityFeePerGas)
    return {
      maxFeePerGas,
      maxPriorityFeePerGas
    }
  }

  async adjustEstimation({ userOperation }: EstimateFeeFunctionProps): Promise<EstimateGasData> {
    return {
      verificationGasLimit:
        userOperation.verificationGasLimit + userOperation.verificationGasLimit / 2n
    }
  }

  async #getMaxPriorityFeePerGas(bundlerClient: ethers.JsonRpcProvider): Promise<bigint> {
    const maxPriorityFeePerGas = await bundlerClient.send('rundler_maxPriorityFeePerGas', [])

    const bufferedMaxPriorityFeePerGas =
      BigInt(maxPriorityFeePerGas) + BigInt(maxPriorityFeePerGas) / 2n // Adding a buffer

    return bufferedMaxPriorityFeePerGas
  }

  async #getMaxFeePerGas(maxPriorityFeePerGas: bigint): Promise<bigint> {
    let maxFeePerGas = 1n

    // Get the latest Block Number
    const latestBlockNum = await this.#alchemySdk.core.getBlockNumber()

    // Get latest Block Details
    const rvBlock = await this.#alchemySdk.core.getBlock(latestBlockNum)
    if (rvBlock && rvBlock.baseFeePerGas) {
      // https://docs.alchemy.com/reference/bundler-api-fee-logic
      maxFeePerGas = BigInt(rvBlock.baseFeePerGas._hex) + maxPriorityFeePerGas
      maxFeePerGas = maxFeePerGas + maxFeePerGas / 2n // Adding a buffer
    }

    return maxFeePerGas
  }
}