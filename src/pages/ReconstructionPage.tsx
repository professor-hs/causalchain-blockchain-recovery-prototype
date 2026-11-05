import React from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';

export const ReconstructionPage: React.FC = () => {
  const { workflowOutput, checkpoint } = useCausalChain();
  if (!workflowOutput) return null;

  const { boundary, reconstruction } = workflowOutput;
  const boundarySet = new Set(boundary.stateObjectsInBoundary);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">
              Selective State Reconstruction Engine (Module 16)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Computes{' '}
            <code className="font-mono text-foreground">
              SB' = Apply(SC, TBv)
            </code>{' '}
            by loading authenticated Checkpoint <code className="font-mono">SC</code> ({checkpoint?.checkpointId}),
            sorting verified transitions <code className="font-mono">TBv</code> by execution sequence,
            recomputing state versions and SHA-256 integrity hashes for <code className="font-mono">SB</code>,
            and verifying that all state outside <code className="font-mono">SB</code> remains completely unchanged.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            data-testid="reconstruction-status-badge"
            className={`px-3.5 py-2 rounded border font-mono text-xs font-bold ${
              reconstruction.status === 'COMPLETED'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            {reconstruction.status}
          </span>
        </div>
      </div>

      {reconstruction.suspensionReason && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3 text-xs text-amber-300">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Reconstruction Suspended / Rejected</div>
            <p className="font-mono mt-1">{reconstruction.suspensionReason}</p>
          </div>
        </div>
      )}

      {/* Invariant Verification Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-muted-foreground">Unaffected State Preservation</div>
            <div className="font-mono font-bold text-sm mt-0.5">
              {reconstruction.unaffectedStatePreserved ? 'VERIFIED (100%)' : 'VIOLATED'}
            </div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-muted-foreground">Reference State Comparison</div>
            <div className="font-mono font-bold text-sm mt-0.5">
              {reconstruction.referenceStateComparison.matchesReference
                ? 'MATCHES EXPECTED REFERENCE'
                : 'HALTED / MISMATCH'}
            </div>
          </div>
          <ShieldCheck
            className={`w-5 h-5 ${
              reconstruction.referenceStateComparison.matchesReference
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          />
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-muted-foreground">Reconstructed State SHA-256</div>
          <div className="font-mono text-[11px] text-blue-400 truncate mt-1">
            {reconstruction.reconstructedStateCommitment}
          </div>
        </div>
      </div>

      {/* Ordered Verified Transitions Processor */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ordered Verified Transitions Applied (TBv: {reconstruction.appliedTransitions.length})
        </h3>
        {reconstruction.appliedTransitions.length === 0 ? (
          <div className="text-xs text-muted-foreground italic p-3 rounded bg-secondary/20 border border-border">
            No selective transitions applied (either boundary is empty or reconstruction is suspended).
          </div>
        ) : (
          <div className="space-y-2">
            {reconstruction.appliedTransitions.map((tr, i) => (
              <div
                key={i}
                className="p-3 rounded bg-secondary/40 border border-border flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">
                    Seq #{tr.executionSequence}
                  </span>
                  <span className="font-bold">{tr.transactionId}</span>
                  <span className="text-muted-foreground">({tr.verifiedByEvidenceId})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">{tr.stateId}</span>
                  <span>
                    v{tr.previousVersion} ("{tr.previousValue}")
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-emerald-400 font-bold">
                    v{tr.resultingVersion} ("{tr.newValue}")
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Before (Checkpoint SC) vs After (Reconstructed SB' + Preserved) State Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Before (Checkpoint SC) vs After (Reconstructed State SB' & Preserved State)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[11px] text-muted-foreground uppercase">
                <th className="py-3 px-4">State ID</th>
                <th className="py-3 px-4">Partition</th>
                <th className="py-3 px-4">Checkpoint SC (Before)</th>
                <th className="py-3 px-4">Reconstructed SB' (After)</th>
                <th className="py-3 px-4">Last Tx</th>
                <th className="py-3 px-4">Resulting SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reconstruction.reconstructedState.map((afterObj) => {
                const beforeObj = reconstruction.beforeState.find(
                  (b) => b.stateId === afterObj.stateId
                );
                const inBoundary = boundarySet.has(afterObj.stateId);
                return (
                  <tr key={afterObj.stateId} className="hover:bg-secondary/20">
                    <td className="py-3 px-4 font-bold text-foreground">
                      {afterObj.stateId}
                    </td>
                    <td className="py-3 px-4">
                      {inBoundary ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px]">
                          IN BOUNDARY (SB)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                          PRESERVED OUTSIDE SB
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      v{beforeObj?.stateVersion} • "{beforeObj?.currentValue}"
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      v{afterObj.stateVersion} • "{afterObj.currentValue}"
                    </td>
                    <td className="py-3 px-4">{afterObj.lastTransaction}</td>
                    <td className="py-3 px-4 text-[11px] text-blue-400">
                      {afterObj.integrityHash.slice(0, 24)}...
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
