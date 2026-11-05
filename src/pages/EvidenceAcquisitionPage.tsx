import React, { useState } from 'react';
import {
  Cpu,
  Database,
  Download,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import {
  AuthenticationStatus,
  ExecutionOutcome,
  StorageCommitStatus,
} from '../types';
import { downloadJsonFile } from '../services/storage';

export const EvidenceAcquisitionPage: React.FC = () => {
  const {
    executionEvidence,
    storageEvidence,
    addExecutionEvidence,
    addStorageEvidence,
    updateStorageEvidence,
    deleteExecutionEvidence,
    deleteStorageEvidence,
    importFullDatasetJson,
  } = useCausalChain();

  // Execution Evidence Form State
  const [execTxId, setExecTxId] = useState('TX-105');
  const [execBlock, setExecBlock] = useState(19400002);
  const [execSeq, setExecSeq] = useState(executionEvidence.length + 1);
  const [execContract, setExecContract] = useState(
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
  );
  const [execReadState, setExecReadState] = useState('KC');
  const [execReadVer, setExecReadVer] = useState(1);
  const [execWriteState, setExecWriteState] = useState('KC');
  const [execPrevVer, setExecPrevVer] = useState(1);
  const [execResVer, setExecResVer] = useState(2);
  const [execNewVal, setExecNewVal] = useState('pool:2800');
  const [execStatus, setExecStatus] = useState<ExecutionOutcome>('SUCCESS');
  const [execAuth, setExecAuth] = useState<AuthenticationStatus>('AUTHENTICATED');

  // Storage Evidence Form State
  const [storTxId, setStorTxId] = useState('TX-105');
  const [storStateKey, setStorStateKey] = useState('KC');
  const [storOrder, setStorOrder] = useState(storageEvidence.length + 1);
  const [storPrevVer, setStorPrevVer] = useState(1);
  const [storVer, setStorVer] = useState(2);
  const [storVal, setStorVal] = useState('pool:2800');
  const [storCommitStatus, setStorCommitStatus] =
    useState<StorageCommitStatus>('COMMITTED');
  const [storAuth, setStorAuth] = useState<AuthenticationStatus>('AUTHENTICATED');

  const [selectedRecordJson, setSelectedRecordJson] = useState<unknown | null>(null);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const handleAddExec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!execTxId.trim() || !execWriteState.trim()) return;
    await addExecutionEvidence({
      evidenceId: `EXEC-MAN-${Date.now().toString(36).toUpperCase().slice(-4)}`,
      transactionId: execTxId.trim(),
      blockNumber: Number(execBlock) || 19400001,
      executionSequence: Number(execSeq) || 1,
      contractAddress: execContract.trim(),
      stateObjectsRead: [
        { stateId: execReadState.trim(), versionRead: Number(execReadVer) },
      ],
      stateObjectsWritten: [
        {
          stateId: execWriteState.trim(),
          previousVersion: Number(execPrevVer),
          resultingVersion: Number(execResVer),
          newValue: execNewVal.trim(),
        },
      ],
      previousStateVersion: Number(execPrevVer),
      resultingStateVersion: Number(execResVer),
      executionStatus: execStatus,
      evidenceSource: 'MANUAL_ENTRY',
      authenticationStatus: execAuth,
      evidenceTimestamp: new Date().toISOString(),
    });
    setExecSeq((s) => s + 1);
    setFormMsg(
      `Added Execution Evidence for ${execTxId}. Note: Storage evidence remains separate and was NOT auto-generated.`
    );
  };

  const handleAddStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storTxId.trim() || !storStateKey.trim()) return;
    await addStorageEvidence({
      evidenceId: `STOR-MAN-${Date.now().toString(36).toUpperCase().slice(-4)}`,
      transactionId: storTxId.trim(),
      affectedStateObject: storStateKey.trim(),
      storageOrdering: Number(storOrder) || 1,
      previousVersion: Number(storPrevVer),
      stateVersion: Number(storVer),
      writtenValue: storVal.trim(),
      operationType: 'WRITE',
      commitStatus: storCommitStatus,
      authenticationStatus: storAuth,
      evidenceSource: 'MANUAL_ENTRY',
      evidenceTimestamp: new Date().toISOString(),
    });
    setStorOrder((o) => o + 1);
    setFormMsg(
      `Added Storage-Operation Evidence for (${storTxId}, ${storStateKey}) with commitStatus=${storCommitStatus}.`
    );
  };

  const handleUploadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = String(ev.target?.result || '');
        await importFullDatasetJson(text);
        setFormMsg('Successfully imported JSON evidence dataset.');
      } catch {
        setFormMsg('Invalid JSON evidence file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold">
            Dual-Stream Evidence Acquisition (Modules 9 & 10)
          </h2>
          <p className="text-xs text-muted-foreground">
            Acquire Execution Evidence{' '}
            <code className="font-mono text-foreground">
              Ei = (Ti, Oi, Ri, Wi, Vi, Si, Ai)
            </code>{' '}
            and Storage-Operation Evidence{' '}
            <code className="font-mono text-foreground">
              Dj = (Tj, Kj, Oj, Vj, Cj, Aj)
            </code>{' '}
            as strictly independent streams. Adding an execution record never fabricates a matching storage record.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary hover:bg-accent border border-border cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Upload JSON Evidence
            <input
              type="file"
              accept=".json"
              onChange={handleUploadJson}
              className="hidden"
            />
          </label>
          <button
            onClick={() =>
              downloadJsonFile('causalchain-evidence-streams.json', {
                executionEvidence,
                storageEvidence,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary hover:bg-accent border border-border"
          >
            <Download className="w-3.5 h-3.5" />
            Export Evidence JSON
          </button>
        </div>
      </div>

      {formMsg && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between text-xs text-blue-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{formMsg}</span>
          </div>
          <button
            onClick={() => setFormMsg(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dual Acquisition Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 9: Execution Evidence Stream */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold">
                Execution Evidence Stream: Ei = (Ti, Oi, Ri, Wi, Vi, Si, Ai)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-400">
              {executionEvidence.length} Records
            </span>
          </div>

          <form onSubmit={handleAddExec} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Transaction ID (Ti)
              </label>
              <input
                type="text"
                value={execTxId}
                onChange={(e) => setExecTxId(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Exec Sequence (Oi)
              </label>
              <input
                type="number"
                value={execSeq}
                onChange={(e) => setExecSeq(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Block Number
              </label>
              <input
                type="number"
                value={execBlock}
                onChange={(e) => setExecBlock(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Read State (Ri)
              </label>
              <input
                type="text"
                value={execReadState}
                onChange={(e) => setExecReadState(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Read Version
              </label>
              <input
                type="number"
                value={execReadVer}
                onChange={(e) => setExecReadVer(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Written State (Wi)
              </label>
              <input
                type="text"
                value={execWriteState}
                onChange={(e) => setExecWriteState(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Prev Version (Vi)
              </label>
              <input
                type="number"
                value={execPrevVer}
                onChange={(e) => setExecPrevVer(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Result Version (Vi')
              </label>
              <input
                type="number"
                value={execResVer}
                onChange={(e) => setExecResVer(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                New State Value
              </label>
              <input
                type="text"
                value={execNewVal}
                onChange={(e) => setExecNewVal(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Exec Outcome (Si)
              </label>
              <select
                value={execStatus}
                onChange={(e) => setExecStatus(e.target.value as ExecutionOutcome)}
                className="w-full bg-background border border-border rounded px-2 py-1.5 font-mono text-xs"
              >
                <option value="SUCCESS">SUCCESS</option>
                <option value="REVERTED">REVERTED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Authentication (Ai)
              </label>
              <select
                value={execAuth}
                onChange={(e) =>
                  setExecAuth(e.target.value as AuthenticationStatus)
                }
                className="w-full bg-background border border-border rounded px-2 py-1.5 font-mono text-xs"
              >
                <option value="AUTHENTICATED">AUTHENTICATED</option>
                <option value="UNVERIFIED">UNVERIFIED</option>
                <option value="INVALID_SIGNATURE">INVALID_SIGNATURE</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Ei Record
              </button>
            </div>
          </form>

          {/* Execution Records List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {executionEvidence.map((rec) => (
              <div
                key={rec.evidenceId}
                className="p-3 rounded bg-secondary/40 border border-border text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-blue-400">{rec.evidenceId}</span>
                    <span>•</span>
                    <span className="font-semibold">{rec.transactionId}</span>
                    <span className="text-muted-foreground">Seq #{rec.executionSequence}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-accent">
                      {rec.evidenceSource}
                    </span>
                    <button
                      onClick={() => setSelectedRecordJson(rec)}
                      className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                    >
                      Inspect
                    </button>
                    <button
                      onClick={() => deleteExecutionEvidence(rec.evidenceId)}
                      className="p-1 text-muted-foreground hover:text-rose-400"
                      title="Delete execution evidence"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                  <div>
                    Reads (Ri):{' '}
                    {rec.stateObjectsRead
                      .map((r) => `${r.stateId}@v${r.versionRead}`)
                      .join(', ')}
                  </div>
                  <div>
                    Writes (Wi):{' '}
                    {rec.stateObjectsWritten
                      .map(
                        (w) =>
                          `${w.stateId} (v${w.previousVersion}→v${w.resultingVersion}, "${w.newValue}")`
                      )
                      .join(', ')}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                  <span>Auth: {rec.authenticationStatus}</span>
                  <span>SHA-256: {rec.evidenceHash.slice(0, 20)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Module 10: Storage-Operation Evidence Stream */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold">
                Storage-Operation Stream: Dj = (Tj, Kj, Oj, Vj, Cj, Aj)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/15 text-indigo-400">
              {storageEvidence.length} Records
            </span>
          </div>

          <form onSubmit={handleAddStorage} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Transaction ID (Tj)
              </label>
              <input
                type="text"
                value={storTxId}
                onChange={(e) => setStorTxId(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                State Object (Kj)
              </label>
              <input
                type="text"
                value={storStateKey}
                onChange={(e) => setStorStateKey(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Storage Order (Oj)
              </label>
              <input
                type="number"
                value={storOrder}
                onChange={(e) => setStorOrder(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Prev Version
              </label>
              <input
                type="number"
                value={storPrevVer}
                onChange={(e) => setStorPrevVer(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Result Version (Vj)
              </label>
              <input
                type="number"
                value={storVer}
                onChange={(e) => setStorVer(Number(e.target.value))}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Written Value
              </label>
              <input
                type="text"
                value={storVal}
                onChange={(e) => setStorVal(e.target.value)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Commit Status (Cj)
              </label>
              <select
                value={storCommitStatus}
                onChange={(e) =>
                  setStorCommitStatus(e.target.value as StorageCommitStatus)
                }
                className="w-full bg-background border border-border rounded px-2 py-1.5 font-mono text-xs"
              >
                <option value="COMMITTED">COMMITTED</option>
                <option value="PERSISTED">PERSISTED</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="REQUESTED">REQUESTED</option>
                <option value="FAILED">FAILED</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Authentication (Aj)
              </label>
              <select
                value={storAuth}
                onChange={(e) =>
                  setStorAuth(e.target.value as AuthenticationStatus)
                }
                className="w-full bg-background border border-border rounded px-2 py-1.5 font-mono text-xs"
              >
                <option value="AUTHENTICATED">AUTHENTICATED</option>
                <option value="UNVERIFIED">UNVERIFIED</option>
                <option value="INVALID_SIGNATURE">INVALID_SIGNATURE</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Dj Record
              </button>
            </div>
          </form>

          {/* Storage Records List with interactive status editor */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {storageEvidence.map((rec) => (
              <div
                key={rec.evidenceId}
                className="p-3 rounded bg-secondary/40 border border-border text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-indigo-400">{rec.evidenceId}</span>
                    <span>•</span>
                    <span className="font-semibold">{rec.transactionId}</span>
                    <span className="text-muted-foreground">
                      Order #{rec.storageOrdering}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label={`Commit status for ${rec.evidenceId}`}
                      value={rec.commitStatus}
                      onChange={(e) =>
                        updateStorageEvidence({
                          ...rec,
                          commitStatus: e.target.value as StorageCommitStatus,
                        })
                      }
                      className="bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono"
                    >
                      <option value="COMMITTED">COMMITTED</option>
                      <option value="PERSISTED">PERSISTED</option>
                      <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                      <option value="REQUESTED">REQUESTED</option>
                      <option value="FAILED">FAILED</option>
                      <option value="UNKNOWN">UNKNOWN</option>
                    </select>
                    <button
                      onClick={() => setSelectedRecordJson(rec)}
                      className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25"
                    >
                      Inspect
                    </button>
                    <button
                      onClick={() => deleteStorageEvidence(rec.evidenceId)}
                      className="p-1 text-muted-foreground hover:text-rose-400"
                      title="Delete storage evidence"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                  <div>
                    State (Kj): <strong className="text-foreground">{rec.affectedStateObject}</strong>{' '}
                    (v{rec.previousVersion} → v{rec.stateVersion})
                  </div>
                  <div>Value: "{rec.writtenValue}"</div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                  <span>Source: {rec.evidenceSource}</span>
                  <span>SHA-256: {rec.evidenceHash.slice(0, 20)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Complete JSON Record Inspector Drawer */}
      {selectedRecordJson !== null && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Complete Evidence Record Inspector (Canonical Structure & SHA-256)
            </h4>
            <button
              onClick={() => setSelectedRecordJson(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close Inspector
            </button>
          </div>
          <pre className="p-3 rounded bg-background border border-border font-mono text-[11px] overflow-x-auto">
            {JSON.stringify(selectedRecordJson, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
