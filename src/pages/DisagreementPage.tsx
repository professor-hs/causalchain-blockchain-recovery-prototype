import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { DisagreementRecord } from '../types';

export const DisagreementPage: React.FC = () => {
  const { workflowOutput } = useCausalChain();
  const [selectedDisagreement, setSelectedDisagreement] =
    useState<DisagreementRecord | null>(null);

  if (!workflowOutput) return null;
  const { disagreements } = workflowOutput;

  const indicatorBadge = (ind: DisagreementRecord['indicator']) => {
    if (ind === '0') {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (ind === '1') {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold">
            Evidence Disagreement Detection Engine (Module 12)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Evaluates consistency predicate{' '}
          <code className="font-mono text-foreground">Mi = Consistent(Xi, Di)</code>{' '}
          and assigns three-valued disagreement indicator{' '}
          <code className="font-mono text-foreground">Δi ∈ {'{0, 1, ⊥}'}</code>.
          Strictly distinguishes confirmed disagreement (<code className="font-mono">Δi = 1</code>)
          from missing, unavailable, or indeterminate evidence (<code className="font-mono">Δi = ⊥</code>)
          so that missing records are not blindly misclassified as state corruption.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
          <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-emerald-400">
                Δi = 0 (Consistent)
              </div>
              <div className="text-[11px] text-muted-foreground">
                Mi = true • Streams aligned
              </div>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {disagreements.filter((d) => d.indicator === '0').length}
            </span>
          </div>

          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/25 flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-rose-400">
                Δi = 1 (Verified Inconsistency)
              </div>
              <div className="text-[11px] text-muted-foreground">
                Mi = false • Confirmed Disagreement
              </div>
            </div>
            <span className="text-lg font-bold font-mono text-rose-400">
              {disagreements.filter((d) => d.indicator === '1').length}
            </span>
          </div>

          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
            <div>
              <div className="font-mono font-bold text-amber-400">
                Δi = ⊥ (Indeterminate / Missing)
              </div>
              <div className="text-[11px] text-muted-foreground">
                Mi = null • Insufficient to prove corruption
              </div>
            </div>
            <span className="text-lg font-bold font-mono text-amber-400">
              {disagreements.filter((d) => d.indicator === '⊥').length}
            </span>
          </div>
        </div>
      </div>

      {/* Disagreements Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-mono text-muted-foreground uppercase">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Predicate Mi</th>
                <th className="py-3 px-4">Indicator Δi</th>
                <th className="py-3 px-4">Sub-Classification</th>
                <th className="py-3 px-4">Tx / State</th>
                <th className="py-3 px-4">Versions (Exp / Obs)</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Resolvable</th>
                <th className="py-3 px-4">Investigate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disagreements.map((d) => (
                <tr key={d.disagreementId} className="hover:bg-secondary/30">
                  <td className="py-3 px-4 font-mono text-blue-400">
                    {d.disagreementId}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {d.consistencyPredicate === true
                      ? 'true'
                      : d.consistencyPredicate === false
                        ? 'false'
                        : 'null (⊥)'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded border font-mono text-xs font-bold ${indicatorBadge(
                        d.indicator
                      )}`}
                    >
                      Δi = {d.indicator}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    {d.subClassification}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    <strong>{d.transactionId}</strong> • {d.stateObjectId}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    v{d.expectedVersion ?? '—'} / v{d.observedVersion ?? '—'}
                  </td>
                  <td className="py-3 px-4 font-mono">{d.severity}</td>
                  <td className="py-3 px-4 font-mono">
                    {d.resolvableFromEvidence ? (
                      <span className="text-emerald-400">YES</span>
                    ) : (
                      <span className="text-rose-400">NO</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedDisagreement(d)}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-accent hover:bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Discrepancy Investigation View */}
      {selectedDisagreement && (
        <div className="bg-card border border-blue-500/40 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              {selectedDisagreement.indicator === '0' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : selectedDisagreement.indicator === '1' ? (
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              ) : (
                <HelpCircle className="w-4 h-4 text-amber-400" />
              )}
              <h3 className="text-sm font-bold">
                Discrepancy Investigation — {selectedDisagreement.disagreementId} (
                {selectedDisagreement.disagreementType})
              </h3>
            </div>
            <button
              onClick={() => setSelectedDisagreement(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <div className="text-muted-foreground font-semibold">
                Detection Explanation:
              </div>
              <p className="p-3 rounded bg-secondary/40 border border-border font-mono text-[11px]">
                {selectedDisagreement.detectionExplanation}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-muted-foreground font-semibold">
                Resolution & Recovery Assessment:
              </div>
              <p className="p-3 rounded bg-secondary/40 border border-border font-mono text-[11px]">
                {selectedDisagreement.resolutionNotes}
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-muted-foreground">
            Evidence References:{' '}
            <span className="text-foreground">
              {selectedDisagreement.evidenceReferences.join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
