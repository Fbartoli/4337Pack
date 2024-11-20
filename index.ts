import Safe from '@safe-global/protocol-kit'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import SafeApiKit from '@safe-global/api-kit'
import type { Address, Hex } from 'viem'



const SIGNER_PRIVATE_KEY = Bun.env.KEY as Hex
const SIGNER_ADDRESS = privateKeyToAccount(SIGNER_PRIVATE_KEY).address
const SAFE_ADDRESS = Bun.env.ADDRESS as Address;

const apiKit = new SafeApiKit({
    chainId: 1n
  })

const newProtocolKit = await Safe.init({
    provider: mainnet.rpcUrls.default.http[0],
    signer: SIGNER_PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS
})

const safeTransactionData = {
    to: SIGNER_ADDRESS,
    data: '0x',
    value: '0',
}

const safeTx = await newProtocolKit.createTransaction({
    transactions: [safeTransactionData],
  });
  console.log(safeTx)
  const safeTxHash = await newProtocolKit.getTransactionHash(safeTx);
  const senderSignature = await newProtocolKit.signHash(safeTxHash);

  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTx.data,
    safeTxHash,
    senderAddress: SIGNER_ADDRESS,
    senderSignature: senderSignature.data,
  });

  let proposedTx = await apiKit.getTransaction(safeTxHash);
  console.log(safeTxHash, proposedTx)

  // Wait for transaction to execute.
  while (!proposedTx.isExecuted) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    proposedTx = await apiKit.getTransaction(safeTxHash);
    console.log(safeTxHash, proposedTx.safeTxHash, 'In the loop')
  }