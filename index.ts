import { gnosis } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { createSafeClient } from '@safe-global/sdk-starter-kit'
import { factoryAbi, rolesAbi } from './abi/gnosisGuild'
import { safeAbi } from './abi/safe'
import { encodeFunctionData, keccak256, encodePacked, getContractAddress } from 'viem'
import * as zodiac from "zodiac-roles-sdk"
import { allow } from "defi-kit/gno"
import { encode, from } from 'ox/AbiParameters'
import { random } from 'ox/Hex'
import type { PermissionSet } from 'zodiac-roles-sdk'

// Constants
const ADDRESSES = {
  ROLE: '0x9646fDAD06d3e24444381f44362a3B0eB343D337',
  FACTORY: '0x000000000000aDdB49795b0f9bA5BC298cDda236',
  SWAPPER: '0x98c0b9965ac74653E8423FA24Ed8f4498ba0D3De',
  MULTISEND: [
    "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526",
    "0x9641d764fc13c8B624c04430C7356C1C7C8102e2"
  ] as const,
  MULTISEND_UNWRAPPER: "0x93B7fCbc63ED8a3a24B59e1C3e6649D50B7427c0",
  TOKENS: {
    EURE: '0xcB444e90D8198415266c6a2724b7900fb12FC56E',
    USDC: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'
  }
} as const

// Environment validation
if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is not set')
}

const SIGNER = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)

const calculateProxyAddress = (initData: string, saltNonce: bigint): string => {
  const byteCode = `0x602d8060093d393df3363d3d373d3d3d363d73${ADDRESSES.ROLE.toLowerCase().slice(2)}5af43d82803e903d91602b57fd5bf3` as `0x${string}`

  const salt = keccak256(encodePacked(
    ["bytes32", "uint256"],
    [keccak256(encodePacked(["bytes"], [initData as `0x${string}`])), saltNonce]
  ))

  return getContractAddress({ 
    bytecode: byteCode,
    from: ADDRESSES.FACTORY, 
    opcode: 'CREATE2', 
    salt
  })
}

async function main() {
  const safeClient = await createSafeClient({
    provider: gnosis.rpcUrls.default.http[0],
    signer: process.env.PRIVATE_KEY as `0x${string}`,
    safeOptions: {
      owners: [SIGNER.address],
      threshold: 1,
    }
  })

  const safeAddress = await safeClient.getAddress()
  const nonce = BigInt(random(32))
  
  // Setup initializer
  const initializer = encodeFunctionData({
    abi: rolesAbi,
    functionName: 'setUp',
    args: [encode(from(['address', 'address', 'address']), 
      [safeAddress, safeAddress, safeAddress] as [`0x${string}`, `0x${string}`, `0x${string}`])]
  })

  const roleProxyAddress = calculateProxyAddress(initializer, nonce)

  // Prepare transactions
  const deployModuleTx = {
    to: ADDRESSES.FACTORY,
    data: encodeFunctionData({
      abi: factoryAbi,
      functionName: 'deployModule',
      args: [ADDRESSES.ROLE, initializer, nonce]
    }),
    value: '0'
  }

  const enableModuleTx = {
    to: safeAddress,
    data: encodeFunctionData({
      abi: safeAbi,
      functionName: 'enableModule',
      args: [roleProxyAddress]
    }),
    value: '0'
  }

  const unwrapperTxs = ADDRESSES.MULTISEND.map(address => ({
    to: roleProxyAddress,
    data: encodeFunctionData({
      abi: rolesAbi,
      functionName: 'setTransactionUnwrapper',
      args: [address, "0x8d80ff0a", ADDRESSES.MULTISEND_UNWRAPPER]
    }),
    value: '0'
  }))

  const permissions: PermissionSet[] = [
    await allow.cowswap.swap({
      buy: undefined, 
      sell: [ADDRESSES.TOKENS.EURE, ADDRESSES.TOKENS.USDC, 'XDAI']
    })
  ]

  const rolesTxs = zodiac.setUpRoles({
    address: roleProxyAddress as `0x${string}`,
    roles: [{
      key: 'admin',
      members: [ADDRESSES.SWAPPER as `0x${string}`],
      permissions
    }]
  })

  const tx = await safeClient.send({
    transactions: [
      deployModuleTx,
      enableModuleTx,
      ...unwrapperTxs,
      ...rolesTxs
    ]
  })

  console.log('Transaction hash:', tx)
}

main().catch(console.error)