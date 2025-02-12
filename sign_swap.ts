import { createPublicClient, createWalletClient, encodeFunctionData } from "viem"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { gnosis } from "viem/chains"
import { getContract } from "viem"
import { cowSignOrder } from "./abi/cowswap"
import { ethers } from "ethers"
import { solidityPackedKeccak256, id } from "ethers"
import { rolesAbi } from "./abi/gnosisGuild"
if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set')
}
const SIGNER_PRIVATE_KEY = process.env.ADMIN_ADDRESS_KEY as `0x${string}`
const SIGNER = privateKeyToAccount(SIGNER_PRIVATE_KEY)
const COWSWAP_ADDRESS = '0x23dA9AdE38E4477b23770DeD512fD37b12381FAB'

const publicClient = createPublicClient({
    transport: http(gnosis.rpcUrls.default.http[0]),
})

const walletClient = createWalletClient({
    account: SIGNER,
    chain: gnosis,
    transport: http()
})

const EURE = '0xcB444e90D8198415266c6a2724b7900fb12FC56E'
const USDC = '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'

const now = Math.floor(Date.now() / 1000);

const demoOrder = {
    sellToken: USDC as `0x${string}`,
    buyToken: EURE as `0x${string}`,
    receiver: "0xf8914f6565F1dCF7179A20c81af04C7C364BDEdE" as `0x${string}`,
    sellAmount: BigInt(1),
    buyAmount: BigInt(1),
    validTo: now + 60 * 30,
    appData: solidityPackedKeccak256(["string"], ["0x"]) as `0x${string}`,
    feeAmount: BigInt(0),
    kind: id("sell") as `0x${string}`,
    partiallyFillable: false,
    sellTokenBalance: id("erc20") as `0x${string}`,
    buyTokenBalance: id("erc20") as `0x${string}`
}

const signOrderData = encodeFunctionData({
    abi: cowSignOrder,
    functionName: 'signOrder',
    args: [demoOrder, now + 60 * 10, BigInt(0)]
})

console.log('signOrderData', signOrderData)
console.log(' ')

const roleActionData = encodeFunctionData({
    abi: rolesAbi,
    functionName: 'execTransactionWithRoleReturnData',
    args: [COWSWAP_ADDRESS, 0n, signOrderData, 1, '0x61646d696e000000000000000000000000000000000000000000000000000000', true]
})

await walletClient.sendTransaction({
    to: '0x711259fcf740BFEeC3f585117f5193e858b2eC36',
    data: roleActionData,
})

