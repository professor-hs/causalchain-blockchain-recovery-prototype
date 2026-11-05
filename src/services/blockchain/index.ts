import { ExecutionEvidence, NetworkId } from '../../types';
import { computeExecutionEvidenceHash } from '../cryptography';

export const PUBLIC_RPC_ENDPOINTS: Record<NetworkId, string> = {
  mainnet: 'https://ethereum-rpc.publicnode.com',
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
};

export interface RpcProvenanceMetadata {
  network: NetworkId;
  endpointUrl: string;
  viaServerlessProxy: boolean;
  retrievedAt: string;
  latencyMs: number;
  chainIdHex?: string;
}

export interface LiveBlockSummary {
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  timestamp: number;
  timestampIso: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  miner: string;
  transactionHashes: string[];
  provenance: RpcProvenanceMetadata;
}

export interface LiveTransactionDetails {
  hash: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  from: string;
  to: string | null;
  valueWei: string;
  valueEth: string;
  gasPriceWei: string;
  gasUsed: string;
  status: 'SUCCESS' | 'REVERTED' | 'PENDING';
  confirmations: number;
  inputDataPreview: string;
  logsCount: number;
  logs: {
    logIndex: number;
    address: string;
    topics: string[];
    data: string;
  }[];
  senderBalanceEth?: string;
  receiverCodePresent?: boolean;
  slot0StorageHex?: string;
  provenance: RpcProvenanceMetadata;
}

// Client-side rate limiter (prevents accidental API abuse)
let lastRpcCallTimestamp = 0;
const MIN_RPC_INTERVAL_MS = 180;

async function throttleRpc(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRpcCallTimestamp;
  if (elapsed < MIN_RPC_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_RPC_INTERVAL_MS - elapsed));
  }
  lastRpcCallTimestamp = Date.now();
}

/**
 * Execute JSON-RPC call via Netlify Serverless Function (`/.netlify/functions/rpc`)
 * with automatic fallback to the configured PublicNode endpoint if local Vite dev/preview is used.
 */
export async function callEthereumRpc<T = unknown>(
  network: NetworkId,
  method: string,
  params: unknown[] = [],
  customEndpoint?: string
): Promise<{ result: T; provenance: RpcProvenanceMetadata }> {
  await throttleRpc();
  const t0 = performance.now();
  const endpointUrl = customEndpoint || PUBLIC_RPC_ENDPOINTS[network];

  // Try Netlify Function proxy first unless customEndpoint is explicitly overridden
  if (!customEndpoint && typeof window !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);
      const res = await fetch('/.netlify/functions/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const payload = await res.json();
        if (payload && payload.result !== undefined) {
          return {
            result: payload.result as T,
            provenance: {
              network,
              endpointUrl: payload.endpoint || endpointUrl,
              viaServerlessProxy: true,
              retrievedAt: new Date().toISOString(),
              latencyMs: Math.round(performance.now() - t0),
            },
          };
        }
      }
    } catch {
      // Fallback to direct public JSON-RPC
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`RPC HTTP error ${response.status} from ${endpointUrl}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(`RPC error (${method}): ${json.error.message || JSON.stringify(json.error)}`);
  }

  return {
    result: json.result as T,
    provenance: {
      network,
      endpointUrl,
      viaServerlessProxy: false,
      retrievedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - t0),
    },
  };
}

function hexToNumber(hex: string | undefined | null): number {
  if (!hex) return 0;
  return parseInt(hex, 16);
}

function weiHexToEthString(weiHex: string | undefined | null): string {
  if (!weiHex || weiHex === '0x0' || weiHex === '0x') return '0.000000';
  try {
    const wei = BigInt(weiHex);
    const ethWhole = wei / 1000000000000000000n;
    const ethRem = (wei % 1000000000000000000n) / 1000000000000n;
    return `${ethWhole.toString()}.${ethRem.toString().padStart(6, '0')}`;
  } catch {
    return '0.000000';
  }
}

export async function fetchNetworkStatus(
  network: NetworkId,
  customEndpoint?: string
): Promise<{
  chainId: number;
  latestBlockNumber: number;
  provenance: RpcProvenanceMetadata;
}> {
  const [chainRes, blockNumRes] = await Promise.all([
    callEthereumRpc<string>(network, 'eth_chainId', [], customEndpoint),
    callEthereumRpc<string>(network, 'eth_blockNumber', [], customEndpoint),
  ]);

  return {
    chainId: hexToNumber(chainRes.result),
    latestBlockNumber: hexToNumber(blockNumRes.result),
    provenance: {
      ...blockNumRes.provenance,
      chainIdHex: chainRes.result,
    },
  };
}

export async function fetchBlockByNumberOrHash(
  network: NetworkId,
  blockIdentifier: number | 'latest' | string,
  customEndpoint?: string
): Promise<LiveBlockSummary> {
  const isHash =
    typeof blockIdentifier === 'string' &&
    blockIdentifier.startsWith('0x') &&
    blockIdentifier.length === 66;
  const method = isHash ? 'eth_getBlockByHash' : 'eth_getBlockByNumber';
  const param =
    blockIdentifier === 'latest'
      ? 'latest'
      : typeof blockIdentifier === 'number'
        ? `0x${blockIdentifier.toString(16)}`
        : blockIdentifier;

  const { result: block, provenance } = await callEthereumRpc<Record<string, unknown>>(
    network,
    method,
    [param, false],
    customEndpoint
  );

  if (!block) {
    throw new Error(`Block ${String(blockIdentifier)} not found on ${network}.`);
  }

  const tsSec = hexToNumber(block.timestamp as string);
  const txs = Array.isArray(block.transactions)
    ? (block.transactions as string[])
    : [];

  return {
    blockNumber: hexToNumber(block.number as string),
    blockHash: (block.hash as string) || '0x',
    parentHash: (block.parentHash as string) || '0x',
    timestamp: tsSec,
    timestampIso: new Date(tsSec * 1000).toISOString(),
    transactionCount: txs.length,
    gasUsed: hexToNumber(block.gasUsed as string).toLocaleString(),
    gasLimit: hexToNumber(block.gasLimit as string).toLocaleString(),
    miner: (block.miner as string) || '0x0000000000000000000000000000000000000000',
    transactionHashes: txs,
    provenance,
  };
}

export async function fetchTransactionAndReceipt(
  network: NetworkId,
  txHash: string,
  customEndpoint?: string
): Promise<LiveTransactionDetails> {
  const cleanHash = txHash.trim();
  const [txRes, receiptRes, latestBlockRes] = await Promise.all([
    callEthereumRpc<Record<string, unknown> | null>(
      network,
      'eth_getTransactionByHash',
      [cleanHash],
      customEndpoint
    ),
    callEthereumRpc<Record<string, unknown> | null>(
      network,
      'eth_getTransactionReceipt',
      [cleanHash],
      customEndpoint
    ),
    callEthereumRpc<string>(network, 'eth_blockNumber', [], customEndpoint),
  ]);

  const tx = txRes.result;
  if (!tx) {
    throw new Error(`Transaction ${cleanHash} not found on ${network}.`);
  }
  const receipt = receiptRes.result;
  const latestBlock = hexToNumber(latestBlockRes.result);
  const txBlock = hexToNumber(tx.blockNumber as string);
  const confirmations = txBlock > 0 && latestBlock >= txBlock ? latestBlock - txBlock + 1 : 0;

  const fromAddr = (tx.from as string) || '';
  const toAddr = (tx.to as string) || null;

  // Query state inspection methods (eth_getBalance, eth_getCode, eth_getStorageAt)
  let senderBalanceEth: string | undefined;
  let receiverCodePresent: boolean | undefined;
  let slot0StorageHex: string | undefined;

  try {
    const [balRes, codeRes, storRes] = await Promise.all([
      fromAddr
        ? callEthereumRpc<string>(
            network,
            'eth_getBalance',
            [fromAddr, 'latest'],
            customEndpoint
          )
        : Promise.resolve(null),
      toAddr
        ? callEthereumRpc<string>(
            network,
            'eth_getCode',
            [toAddr, 'latest'],
            customEndpoint
          )
        : Promise.resolve(null),
      toAddr
        ? callEthereumRpc<string>(
            network,
            'eth_getStorageAt',
            [toAddr, '0x0', 'latest'],
            customEndpoint
          )
        : Promise.resolve(null),
    ]);
    if (balRes) senderBalanceEth = weiHexToEthString(balRes.result);
    if (codeRes) receiverCodePresent = Boolean(codeRes.result && codeRes.result !== '0x');
    if (storRes) slot0StorageHex = storRes.result;
  } catch {
    // Non-fatal state enrichment
  }

  const rawLogs = Array.isArray(receipt?.logs)
    ? (receipt!.logs as Record<string, unknown>[])
    : [];

  return {
    hash: (tx.hash as string) || cleanHash,
    blockNumber: txBlock,
    blockHash: (tx.blockHash as string) || '0x',
    transactionIndex: hexToNumber(tx.transactionIndex as string),
    from: fromAddr,
    to: toAddr,
    valueWei: BigInt((tx.value as string) || '0x0').toString(),
    valueEth: weiHexToEthString(tx.value as string),
    gasPriceWei: BigInt((tx.gasPrice as string) || '0x0').toString(),
    gasUsed: receipt ? hexToNumber(receipt.gasUsed as string).toLocaleString() : 'Pending',
    status: !receipt
      ? 'PENDING'
      : receipt.status === '0x1'
        ? 'SUCCESS'
        : 'REVERTED',
    confirmations,
    inputDataPreview: ((tx.input as string) || '0x').slice(0, 66),
    logsCount: rawLogs.length,
    logs: rawLogs.slice(0, 20).map((l) => ({
      logIndex: hexToNumber(l.logIndex as string),
      address: (l.address as string) || '0x',
      topics: Array.isArray(l.topics) ? (l.topics as string[]) : [],
      data: (l.data as string) || '0x',
    })),
    senderBalanceEth,
    receiverCodePresent,
    slot0StorageHex,
    provenance: receiptRes.provenance,
  };
}

/**
 * Convert a live observed Ethereum transaction into an ExecutionEvidence record.
 * Strictly adheres to Section 4:
 * - Labels inferred state transitions as LIVE_RPC_INFERRED.
 * - Never fabricates a matching StorageEvidence record from a public RPC receipt.
 */
export async function convertLiveTxToExecutionEvidence(
  tx: LiveTransactionDetails
): Promise<ExecutionEvidence> {
  const targetAddress = tx.to || tx.from;
  const stateKey = `ACCT_${targetAddress.slice(0, 10).toUpperCase()}`;
  const seq = tx.transactionIndex > 0 ? tx.transactionIndex : 1;

  const baseRecord: Omit<ExecutionEvidence, 'evidenceHash'> = {
    evidenceId: `EXEC-RPC-${tx.hash.slice(2, 10).toUpperCase()}`,
    transactionId: tx.hash.slice(0, 18) + '...',
    blockNumber: tx.blockNumber,
    executionSequence: seq,
    contractAddress: targetAddress,
    stateObjectsRead: [
      {
        stateId: stateKey,
        versionRead: 1,
        valueRead: tx.slot0StorageHex || `balance:${tx.valueEth}_ETH`,
      },
    ],
    stateObjectsWritten: [
      {
        stateId: stateKey,
        previousVersion: 1,
        resultingVersion: 2,
        previousValue: 'inferred_pre_state',
        newValue: `tx_val:${tx.valueEth}_ETH_logs:${tx.logsCount}`,
      },
    ],
    previousStateVersion: 1,
    resultingStateVersion: 2,
    executionStatus: tx.status === 'SUCCESS' ? 'SUCCESS' : 'REVERTED',
    evidenceSource: 'LIVE_RPC_INFERRED',
    authenticationStatus: 'INFERRED_PROVENANCE',
    evidenceTimestamp: tx.provenance.retrievedAt,
    provenanceNote: `Observed on ${tx.provenance.network} Block #${tx.blockNumber} (${tx.hash}). Transaction envelope & receipt fields are real RPC observations; internal EVM state versions are labeled INFERRED. Independent storage-engine commit logs are UNAVAILABLE from public JSON-RPC and are NEVER fabricated.`,
  };

  const evidenceHash = await computeExecutionEvidenceHash(baseRecord);
  return {
    ...baseRecord,
    evidenceHash,
  };
}
