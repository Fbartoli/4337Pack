import { Safe4337Pack } from '@safe-global/relay-kit'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const SIGNER_PRIVATE_KEY = generatePrivateKey()
const SIGNER_ADDRESS = privateKeyToAccount(SIGNER_PRIVATE_KEY).address
const RPC_URL = 'https://base-sepolia.g.alchemy.com/v2/G6Kjp2b01jHSPtNexytKoX8IdW7CuG6d'

const safe4337Pack = await Safe4337Pack.init({
    provider: RPC_URL,
    signer: SIGNER_PRIVATE_KEY,
    bundlerUrl: `https://api.pimlico.io/v1/${baseSepolia.id}/rpc?apikey=${Bun.env.PIMLICO_API_KEY}`,
    options: {
        owners: [SIGNER_ADDRESS],
        threshold: 1
    },
    paymasterOptions: {
        isSponsored: true,
        paymasterUrl: `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${Bun.env.PIMLICO_API_KEY}`,
        sponsorshipPolicyId: Bun.env.SPONSORSHIP_POLICY_ID
    }
})

// Define the transactions to execute
const transaction1 = { to: SIGNER_ADDRESS, data: '0x', value: '0' }

// Build the transaction array
const transactions = [transaction1]

// Create the SafeOperation with all the transactions
const safeOperation = await safe4337Pack.createTransaction({ transactions })
const signedSafeOperation = await safe4337Pack.signSafeOperation(safeOperation)
const userOperationHash = await safe4337Pack.executeTransaction({
    executable: signedSafeOperation
})
let userOperationReceipt = null

while (!userOperationReceipt) {
    // Wait 2 seconds before checking the status again
    await new Promise((resolve) => setTimeout(resolve, 2000))
    userOperationReceipt = await safe4337Pack.getUserOperationReceipt(
        userOperationHash
    )
    console.log(userOperationReceipt)
}
const userOperationPayload = await safe4337Pack.getUserOperationByHash(
    userOperationHash
)

console.log(userOperationPayload)