import { gnosis } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { createSafeClient } from '@safe-global/sdk-starter-kit'
import { factoryAbi, rolesAbi } from './abi/gnosisGuild'
import { safeAbi } from './abi/safe'
import { encodeFunctionData, keccak256, encodePacked, getContractAddress } from 'viem'
import * as zodiac from "zodiac-roles-sdk";
import { allow } from "defi-kit/gno"

import { encode, from } from 'ox/AbiParameters'
import type { PermissionSet } from 'zodiac-roles-sdk'
import { random } from 'ox/Hex'

if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is not set')
}
const SIGNER_PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`
const SIGNER = privateKeyToAccount(SIGNER_PRIVATE_KEY)
const ROLE_ADDRESS = '0x9646fDAD06d3e24444381f44362a3B0eB343D337'
const FACTORY_ADDRESS = '0x000000000000aDdB49795b0f9bA5BC298cDda236'
const DEFAULT_MULTISEND_ADDRESSES = [
  "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526", // https://github.com/safe-global/safe-deployments/blob/5ec81e8d7a85d66a33adbe0c098068c0a96d917c/src/assets/v1.4.1/multi_send.json
  "0x9641d764fc13c8B624c04430C7356C1C7C8102e2", // https://github.com/safe-global/safe-deployments/blob/5ec81e8d7a85d66a33adbe0c098068c0a96d917c/src/assets/v1.4.1/multi_send_call_only.json
] as const
const SWAPPER_ADDRESS = '0x98c0b9965ac74653E8423FA24Ed8f4498ba0D3De'

const calculateProxyAddress = (
  initData: string,
  saltNonce: bigint
): string => {
  const mastercopyAddressFormatted = ROLE_ADDRESS
    .toLowerCase()
    .replace(/^0x/, "");
  const byteCode =
    "0x602d8060093d393df3363d3d373d3d3d363d73" +
    mastercopyAddressFormatted +
    "5af43d82803e903d91602b57fd5bf3";

  const salt = keccak256(encodePacked(
    ["bytes32", "uint256"],
    [keccak256(encodePacked(["bytes"], [initData as `0x${string}`])), saltNonce]
  ));

  return getContractAddress({ 
    bytecode: byteCode as `0x${string}`,
    from: FACTORY_ADDRESS, 
    opcode: 'CREATE2', 
    salt, 
  }); 
};

const safeClient = await createSafeClient({
  provider: gnosis.rpcUrls.default.http[0],
  signer: SIGNER_PRIVATE_KEY,
  safeOptions: {
    owners: [SIGNER.address],
    threshold: 1,
  },
})

const safeAddress = await safeClient.getAddress()
const nonce = BigInt(random(32))
const initializer = encodeFunctionData({
  abi: rolesAbi,
  functionName: 'setUp',
  args: [encode(from([
    'address', 'address', 'address'
  ]), [
    safeAddress as `0x${string}`,
    safeAddress as `0x${string}`,
    safeAddress as `0x${string}`
  ])]
})
console.log('encoded initializer', ROLE_ADDRESS, initializer, nonce)
const encodeDeployModule = encodeFunctionData({
  abi: factoryAbi,
  functionName: 'deployModule',
  args: [ROLE_ADDRESS, initializer, BigInt(nonce)],
})

const roleProxyaddress = calculateProxyAddress(initializer, nonce)
console.log('roleProxyaddress',roleProxyaddress)

const enableModule = encodeFunctionData({
  abi: safeAbi,
  functionName: 'enableModule',
  args: [roleProxyaddress],
})

const MULTISEND_SELECTOR = "0x8d80ff0a"
const MULTISEND_UNWRAPPER = "0x93B7fCbc63ED8a3a24B59e1C3e6649D50B7427c0"
const setTransactionUnwrapperCalls = DEFAULT_MULTISEND_ADDRESSES.map(address => ({
  to: roleProxyaddress,
  data: encodeFunctionData({
    abi: rolesAbi,
    functionName: 'setTransactionUnwrapper',
    args: [address, MULTISEND_SELECTOR, MULTISEND_UNWRAPPER],
  }),
  value: '0',
}))
const EURE = '0xcB444e90D8198415266c6a2724b7900fb12FC56E'
const USDC = '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'

// Mix and match the permissions you need
const permissions: PermissionSet[] = [
  await allow.cowswap.swap({buy: undefined, sell: [EURE, USDC, 'XDAI']})
]

const setUpRolesCalls = zodiac.setUpRoles({
  address: roleProxyaddress as `0x${string}`,
  roles: [
    {
      key: 'admin',
      members: [SWAPPER_ADDRESS as `0x${string}`],
      permissions: permissions
    }
  ]
})


const tx = await safeClient.send({
  transactions: [
    {
      to: FACTORY_ADDRESS,
      data: encodeDeployModule,
      value: '0',
    },
    {
      to: safeAddress,
      data: enableModule,
      value: '0',
    },
    ...setTransactionUnwrapperCalls,
    ...setUpRolesCalls,
  ],
})

console.log(tx)