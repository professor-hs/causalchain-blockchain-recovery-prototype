import React from 'react';
import { CheckCircle2, Download, Shield, XCircle } from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { downloadJsonFile } from '../services/storage';

export const BoundaryPage: React.FC = () => {
  const { workflowOutput } = useCausalChain();
  if (!workflowOutput) return null;

  const { boundary } = workflowOutput;

  const badgeClass =
    boundary.outcome === 'CERTIFIED'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : boundary.outcome === 'PROVISIONAL'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-400 border-rose-500/30';

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">
              Causal Boundary Certification Module (Module 15)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Derives and certifies the formal Causal Boundary tuple{' '}
            <code className="font-mono text-foreground">
              B = (SB, TB, EB, CB, UB)
            </code>{' '}
            from disagreement records, evidence completeness, BFS causal dependency propagation, and authenticated checkpoint coverage.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            data-testid="boundary-outcome-badge"
            className={`px-3.5 py-2 rounded border font-mono text-xs font-bold ${badgeClass}`}
          >
            {boundary.outcome}
          </span>
          <button
            onClick={() =>
              downloadJsonFile(
                `boundary-certificate-${boundary.boundaryId}.json`,
                boundary
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Download Boundary JSON
          </button>
        </div>
      </div>

      {/* Certification Explanation */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>Boundary ID: {boundary.boundaryId}</span>
          <span>SHA-256 Commitment: {boundary.boundaryCommitment}</span>
        </div>
        <p className="text-xs font-mono p-3 rounded bg-secondary/40 border border-border">
          {boundary.certificationExplanation}
        </p>

        {/* Mandatory Certification Checks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 text-xs">
          {Object.entries(boundary.mandatoryChecks).map(([key, passed]) => (
            <div
              key={key}
              className="p-3 rounded bg-secondary/30 border border-border flex items-center justify-between"
            >
              <span className="font-mono text-[11px]">{key}</span>
              {passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tuple B = (SB, TB, EB, CB, UB) Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="font-mono font-bold text-amber-400">
            SB — State Objects in Boundary ({boundary.stateObjectsInBoundary.length})
          </div>
          <p className="text-[11px] text-muted-foreground">
            State keys isolated for selective state reconstruction:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {boundary.stateObjectsInBoundary.length === 0 ? (
              <span className="font-mono text-muted-foreground">∅ (Empty — No affected state)</span>
            ) : (
              boundary.stateObjectsInBoundary.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold"
                >
                  {s}
                </span>
              ))
            )}
          </div>
          <div className="pt-3 border-t border-border mt-3">
            <div className="font-mono font-bold text-emerald-400 mb-1">
              Unaffected State Objects Outside SB ({boundary.unaffectedStateObjects.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {boundary.unaffectedStateObjects.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono"
                >
                  {s} (Preserved)
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="font-mono font-bold text-blue-400">
            TB — Relevant Transactions ({boundary.relevantTransactions.length})
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ordered transactions within the causal cone of SB:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {boundary.relevantTransactions.length === 0 ? (
              <span className="font-mono text-muted-foreground">∅ (None)</span>
            ) : (
              boundary.relevantTransactions.map((tx) => (
                <span
                  key={tx}
                  className="px-2.5 py-1 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono"
                >
                  {tx}
                </span>
              ))
            )}
          </div>
          <div className="pt-3 border-t border-border mt-3 font-mono text-[11px] space-y-1">
            <div className="text-muted-foreground">
              CB — Authenticated Checkpoint:
            </div>
            <div className="text-foreground font-bold">
              {boundary.authenticatedCheckpointId}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              Hash: {boundary.checkpointCommitment}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="font-mono font-bold text-rose-400">
            UB — Unresolved Uncertainty ({boundary.unresolvedUncertainty.length})
          </div>
          {boundary.unresolvedUncertainty.length === 0 ? (
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono text-[11px]">
              UB = ∅ — Zero unresolved critical uncertainty items. Boundary satisfies strict certification requirements.
            </div>
          ) : (
            <ul className="space-y-1.5 font-mono text-[11px] text-rose-300">
              {boundary.unresolvedUncertainty.map((u, i) => (
                <li
                  key={i}
                  className="p-2 rounded bg-rose-500/10 border border-rose-500/25"
                >
                  {u}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
