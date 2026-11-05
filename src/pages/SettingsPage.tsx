import React, { useState } from 'react';
import {
  Database,
  Download,
  FolderOpen,
  RotateCcw,
  Save,
  Settings,
  Upload,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { PUBLIC_RPC_ENDPOINTS } from '../services/blockchain';
import { downloadJsonFile } from '../services/storage';

export const SettingsPage: React.FC = () => {
  const {
    network,
    rpcEndpoints,
    setRpcEndpoints,
    checkpoint,
    executionEvidence,
    storageEvidence,
    referenceEndState,
    workflowOutput,
    auditLogs,
    benchmarks,
    savedSnapshots,
    saveCurrentSnapshot,
    loadSnapshot,
    resetAllDemoData,
    importFullDatasetJson,
  } = useCausalChain();

  const [snapshotName, setSnapshotName] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCurrentSnapshot(snapshotName);
    setSnapshotName('');
    setStatusNotice('Saved experiment snapshot to browser IndexedDB.');
  };

  const handleImportDataset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await importFullDatasetJson(String(ev.target?.result || ''));
        setStatusNotice('Successfully imported full experiment dataset JSON.');
      } catch {
        setStatusNotice('Failed to parse uploaded JSON dataset.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-card border border-border rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold">
            System Settings, Public RPC Configuration & IndexedDB Data Management (Modules 15 & 24)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage keyless public Ethereum JSON-RPC endpoints, save and restore experiment
          snapshots in browser IndexedDB, and export/import complete JSON datasets,
          certificates, and hash-linked audit logs. No secret keys or paid API credentials
          are stored in frontend code or browser storage.
        </p>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
          <span>{statusNotice}</span>
          <button
            onClick={() => setStatusNotice(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Public RPC Configuration */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-bold">
          Configurable Public Ethereum JSON-RPC Endpoints (Default Keyless PublicNode)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1">
              Ethereum Mainnet JSON-RPC URL
            </label>
            <input
              type="text"
              value={rpcEndpoints.mainnet}
              onChange={(e) =>
                setRpcEndpoints((prev) => ({ ...prev, mainnet: e.target.value }))
              }
              className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-muted-foreground mb-1">
              Ethereum Sepolia JSON-RPC URL
            </label>
            <input
              type="text"
              value={rpcEndpoints.sepolia}
              onChange={(e) =>
                setRpcEndpoints((prev) => ({ ...prev, sepolia: e.target.value }))
              }
              className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setRpcEndpoints({ ...PUBLIC_RPC_ENDPOINTS });
            setStatusNotice('Restored default PublicNode RPC endpoints.');
          }}
          className="px-3 py-1.5 rounded bg-secondary hover:bg-accent border border-border text-xs font-medium"
        >
          Restore Default PublicNode URLs
        </button>
      </div>

      {/* IndexedDB Experiment Snapshot Manager */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold">
            Browser IndexedDB Experiment Snapshot Persistence
          </h3>
        </div>

        <form onSubmit={handleSaveSnapshot} className="flex gap-2">
          <input
            type="text"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Enter snapshot label (e.g. Custom Version Conflict Test)"
            className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
          >
            <Save className="w-3.5 h-3.5" />
            Save Snapshot to IndexedDB
          </button>
        </form>

        {savedSnapshots.length === 0 ? (
          <div className="text-xs text-muted-foreground italic p-3 rounded bg-secondary/20 border border-border">
            No custom snapshots saved yet. Save the current state above to persist across sessions.
          </div>
        ) : (
          <div className="space-y-2">
            {savedSnapshots.map((snap) => (
              <div
                key={snap.snapshotId}
                className="p-3 rounded bg-secondary/40 border border-border flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold">
                    {snap.name}{' '}
                    <span className="font-mono text-[10px] text-blue-400">
                      ({snap.snapshotId})
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Saved: {snap.savedAt} • {snap.executionEvidence.length} Ei /{' '}
                    {snap.storageEvidence.length} Dj
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await loadSnapshot(snap.snapshotId);
                    setStatusNotice(`Loaded snapshot "${snap.name}".`);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-accent hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Load
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export / Import / Reset Controls */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-bold">
          Complete Data Export, Import & Demo Reset
        </h3>
        <div className="flex flex-wrap gap-2.5 text-xs">
          <button
            onClick={() =>
              downloadJsonFile('causalchain-complete-export.json', {
                exportedAt: new Date().toISOString(),
                network,
                checkpoint,
                executionEvidence,
                storageEvidence,
                referenceEndState,
                workflowOutput,
                auditLogs,
                benchmarks,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export All Data as JSON
          </button>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-secondary hover:bg-accent border border-border font-medium cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Import Experiment Dataset JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImportDataset}
              className="hidden"
            />
          </label>

          {workflowOutput?.certificate && (
            <button
              onClick={() =>
                downloadJsonFile(
                  `certificate-${workflowOutput.certificate!.certificateId}.json`,
                  workflowOutput.certificate
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-secondary hover:bg-accent border border-border font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export Active Certificate
            </button>
          )}

          <button
            onClick={() =>
              downloadJsonFile('causalchain-audit-logs.json', auditLogs)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-secondary hover:bg-accent border border-border font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit Logs
          </button>

          <button
            onClick={async () => {
              await resetAllDemoData();
              setStatusNotice(
                'Reset all IndexedDB demo data and restored default Scenario H dataset.'
              );
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Data & Restore Sample Dataset
          </button>
        </div>
      </div>
    </div>
  );
};
