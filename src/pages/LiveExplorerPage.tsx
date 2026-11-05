import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import {
  LiveBlockSummary,
  LiveTransactionDetails,
  PUBLIC_RPC_ENDPOINTS,
  convertLiveTxToExecutionEvidence,
  fetchBlockByNumberOrHash,
  fetchTransactionAndReceipt,
} from '../services/blockchain';

export const LiveExplorerPage: React.FC = () => {
  const {
    network,
    setNetwork,
    rpcEndpoints,
    addExecutionEvidence,
    setActivePage,
  } = useCausalChain();

  const [blockInput, setBlockInput] = useState<string>('latest');
  const [txHashInput, setTxHashInput] = useState<string>('');
  const [blockData, setBlockData] = useState<LiveBlockSummary | null>(null);
  const [txData, setTxData] = useState<LiveTransactionDetails | null>(null);
  const [loadingBlock, setLoadingBlock] = useState<boolean>(false);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const handleFetchBlock = async (identifier: string | number = blockInput) => {
    setLoadingBlock(true);
    setErrorMsg(null);
    try {
      const clean = String(identifier).trim();
      const target =
        clean === '' || clean.toLowerCase() === 'latest'
          ? 'latest'
          : clean.startsWith('0x')
            ? clean
            : parseInt(clean, 10);
      const blk = await fetchBlockByNumberOrHash(
        network,
        target,
        rpcEndpoints[network]
      );
      setBlockData(blk);
      if (blk.transactionHashes.length > 0 && !txHashInput) {
        setTxHashInput(blk.transactionHashes[0]);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to retrieve block from public RPC'
      );
    } finally {
      setLoadingBlock(false);
    }
  };

  const handleInspectTransaction = async (hashToFetch?: string) => {
    const targetHash = (hashToFetch ?? txHashInput).trim();
    if (!targetHash) return;
    setLoadingTx(true);
    setErrorMsg(null);
    setImportNotice(null);
    try {
      const details = await fetchTransactionAndReceipt(
        network,
        targetHash,
        rpcEndpoints[network]
      );
      setTxData(details);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve transaction and receipt from public RPC'
      );
    } finally {
      setLoadingTx(false);
    }
  };

  const handleImportTxIntoEvidence = async () => {
    if (!txData) return;
    const execRecord = await convertLiveTxToExecutionEvidence(txData);
    await addExecutionEvidence(execRecord);
    setImportNotice(
      `Imported transaction ${txData.hash.slice(0, 14)}... into Execution Evidence as ${execRecord.evidenceId} (labeled LIVE_RPC_INFERRED). Per protocol rules, NO synthetic storage-operation record was fabricated.`
    );
  };

  useEffect(() => {
    handleFetchBlock('latest');
  }, [network]);

  return (
    <div className="space-y-6">
      {/* Header & Network Controls */}
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">
              Live Ethereum JSON-RPC Blockchain Explorer
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Keyless public RPC integration via{' '}
            <code className="font-mono text-foreground">
              {PUBLIC_RPC_ENDPOINTS[network]}
            </code>
            . Inspect live blocks, transaction receipts, event logs, and account state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setNetwork('mainnet')}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              network === 'mainnet'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            Ethereum Mainnet
          </button>
          <button
            onClick={() => setNetwork('sepolia')}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              network === 'sepolia'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            Ethereum Sepolia
          </button>
          <button
            onClick={() => handleFetchBlock('latest')}
            disabled={loadingBlock}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-accent hover:bg-accent/80 border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingBlock ? 'animate-spin' : ''}`} />
            Fetch Latest Block
          </button>
        </div>
      </div>

      {/* Important Technical Limitation Callout (Section 4) */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3 text-xs">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-amber-300">
            Public JSON-RPC Provenance & Evidence Boundary Notice
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Public Ethereum JSON-RPC guarantees block headers, transaction envelopes,
            receipts, event logs, and top-level state queries (<code className="font-mono">eth_getBalance</code>,{' '}
            <code className="font-mono">eth_getCode</code>, <code className="font-mono">eth_getStorageAt</code>),
            but does <strong>not</strong> expose internal EVM read/write version sets or
            independent storage-engine commit logs. When importing a live transaction into the
            Evidence Acquisition module, internal state transitions are explicitly labeled{' '}
            <code className="font-mono text-amber-300">LIVE_RPC_INFERRED</code>, and storage-operation
            commit evidence is marked <code className="font-mono text-amber-300">UNAVAILABLE</code> rather
            than fabricated.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3.5 flex items-center gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {importNotice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{importNotice}</span>
          </div>
          <button
            onClick={() => setActivePage('evidence')}
            className="px-3 py-1 rounded bg-emerald-600 text-white font-medium shrink-0"
          >
            View in Evidence Module
          </button>
        </div>
      )}

      {/* Search Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Block Lookup */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inspect Block by Number or Hash (eth_getBlockByNumber / eth_getBlockByHash)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={blockInput}
              onChange={(e) => setBlockInput(e.target.value)}
              placeholder="Enter block number (e.g. 19500000) or 'latest'"
              className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleFetchBlock(blockInput)}
              disabled={loadingBlock}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
            >
              {loadingBlock ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Inspect Block
            </button>
          </div>
        </div>

        {/* Transaction Hash Lookup */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inspect Transaction & Receipt by Hash (eth_getTransactionByHash + Receipt)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={txHashInput}
              onChange={(e) => setTxHashInput(e.target.value)}
              placeholder="Paste 0x... transaction hash"
              className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleInspectTransaction()}
              disabled={loadingTx || !txHashInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
            >
              {loadingTx ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Inspect Tx
            </button>
          </div>
        </div>
      </div>

      {/* Block Details Panel */}
      {blockData && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold">
                Observed Block #{blockData.blockNumber.toLocaleString()} ({network.toUpperCase()})
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ACTUAL RPC OBSERVATION
              </span>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Retrieved: {blockData.provenance.retrievedAt} ({blockData.provenance.latencyMs}ms via{' '}
              {blockData.provenance.endpointUrl})
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded bg-secondary/40 border border-border">
              <div className="text-muted-foreground text-[11px]">Block Hash</div>
              <div className="font-mono text-[11px] truncate mt-0.5" title={blockData.blockHash}>
                {blockData.blockHash}
              </div>
            </div>
            <div className="p-3 rounded bg-secondary/40 border border-border">
              <div className="text-muted-foreground text-[11px]">Parent Hash</div>
              <div className="font-mono text-[11px] truncate mt-0.5" title={blockData.parentHash}>
                {blockData.parentHash}
              </div>
            </div>
            <div className="p-3 rounded bg-secondary/40 border border-border">
              <div className="text-muted-foreground text-[11px]">Block Timestamp</div>
              <div className="font-mono text-[11px] mt-0.5">{blockData.timestampIso}</div>
            </div>
            <div className="p-3 rounded bg-secondary/40 border border-border">
              <div className="text-muted-foreground text-[11px]">
                Transactions & Gas Used
              </div>
              <div className="font-mono text-[11px] mt-0.5">
                {blockData.transactionCount} txs • {blockData.gasUsed} gas
              </div>
            </div>
          </div>

          {/* Transaction Hashes in Block */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Transactions in Block #{blockData.blockNumber} (Click any hash to inspect receipt & logs):
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {blockData.transactionHashes.slice(0, 24).map((hash, idx) => (
                <button
                  key={hash}
                  onClick={() => {
                    setTxHashInput(hash);
                    handleInspectTransaction(hash);
                  }}
                  className="text-left px-3 py-1.5 rounded bg-secondary/30 hover:bg-blue-500/15 border border-border hover:border-blue-500/40 font-mono text-[11px] flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="truncate">
                    <span className="text-muted-foreground mr-2">#{idx}</span>
                    {hash}
                  </span>
                  <ExternalLink className="w-3 h-3 text-blue-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transaction & Receipt Inspection Panel */}
      {txData && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                  Transaction & Receipt Inspection
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    txData.status === 'SUCCESS'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {txData.status}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  {txData.confirmations} Confirmations
                </span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground mt-1">
                Hash: {txData.hash}
              </div>
            </div>

            <button
              onClick={handleImportTxIntoEvidence}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Import Available Info to Execution Evidence
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded bg-secondary/40 border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Sender (from)</span>
                <span className="text-[10px] font-mono text-emerald-400">OBSERVED</span>
              </div>
              <div className="font-mono text-[11px] truncate">{txData.from}</div>
              {txData.senderBalanceEth && (
                <div className="text-[10px] text-muted-foreground font-mono">
                  eth_getBalance: {txData.senderBalanceEth} ETH
                </div>
              )}
            </div>

            <div className="p-3 rounded bg-secondary/40 border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Receiver / Contract (to)</span>
                <span className="text-[10px] font-mono text-emerald-400">OBSERVED</span>
              </div>
              <div className="font-mono text-[11px] truncate">
                {txData.to ?? 'Contract Creation'}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Contract Code: {txData.receiverCodePresent ? 'Present (Smart Contract)' : 'EOA / None'}
              </div>
            </div>

            <div className="p-3 rounded bg-secondary/40 border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">Value & Gas Used</span>
                <span className="text-[10px] font-mono text-emerald-400">OBSERVED</span>
              </div>
              <div className="font-mono text-[11px]">
                {txData.valueEth} ETH ({txData.gasUsed} gas)
              </div>
              {txData.slot0StorageHex && (
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  slot[0]: {txData.slot0StorageHex}
                </div>
              )}
            </div>
          </div>

          {/* Event Logs */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Receipt Event Logs ({txData.logsCount} emitted logs):
            </div>
            {txData.logs.length === 0 ? (
              <div className="text-xs text-muted-foreground italic p-3 rounded bg-secondary/20 border border-border">
                No event logs emitted by this transaction.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {txData.logs.map((log) => (
                  <div
                    key={log.logIndex}
                    className="p-2.5 rounded bg-secondary/30 border border-border font-mono text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between text-blue-400">
                      <span>Log #{log.logIndex} • Contract: {log.address}</span>
                      <span className="text-[10px] text-emerald-400">ACTUAL RECEIPT LOG</span>
                    </div>
                    <div className="text-muted-foreground truncate">
                      Topic[0]: {log.topics[0] ?? 'None'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
