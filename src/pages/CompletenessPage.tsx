import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';

export const CompletenessPage: React.FC = () => {
  const { workflowOutput } = useCausalChain();
  if (!workflowOutput) return null;

  const { completeness } = workflowOutput;

  const statusColor =
    completeness.status === 'SUFFICIENT'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : completeness.status === 'CONDITIONALLY_SUFFICIENT'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-400 border-rose-500/30';

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">
              Rule-Based Evidence Completeness Assessment (Module 13)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Evaluates 10 explicit protocol completeness rules.{' '}
            <strong className="text-foreground">
              Critical Invariant: A high descriptive coverage percentage never overrides a failed mandatory evidence requirement.
            </strong>{' '}
            If evidence is <code className="font-mono">INSUFFICIENT</code>, state reconstruction is automatically suspended.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Descriptive Coverage
            </div>
            <div className="text-lg font-bold font-mono">
              {completeness.descriptiveCoveragePercentage}%
            </div>
          </div>
          <div
            data-testid="completeness-status-badge"
            className={`px-3.5 py-2 rounded-md border font-mono text-xs font-bold ${statusColor}`}
          >
            {completeness.status}
          </div>
        </div>
      </div>

      {/* 10 Validation Rules Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            10-Point Protocol Completeness Rule Evaluation
          </h3>
          <span className="text-xs font-mono">
            Mandatory Rules Passed:{' '}
            <strong
              className={
                completeness.mandatoryRulesPassed
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }
            >
              {completeness.mandatoryRulesPassed ? 'YES' : 'NO (RECONSTRUCTION SUSPENDED)'}
            </strong>
          </span>
        </div>
        <div className="divide-y divide-border">
          {completeness.ruleResults.map((rule) => (
            <div
              key={rule.ruleId}
              className="p-4 flex items-start justify-between gap-4 hover:bg-secondary/20"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {rule.status === 'PASS' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : rule.status === 'WARN' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="font-mono text-blue-400">{rule.ruleId}</span>
                    <span>{rule.ruleName}</span>
                    {rule.mandatory && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-secondary border border-border text-muted-foreground">
                        MANDATORY
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {rule.details}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                  rule.status === 'PASS'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : rule.status === 'WARN'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                {rule.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Missing Evidence, Rejection Reasons & Required Additional Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Reasons for Rejection / Suspension ({completeness.reasonsForRejection.length})</span>
          </div>
          {completeness.reasonsForRejection.length === 0 ? (
            <p className="text-muted-foreground italic">
              No mandatory rule failures detected.
            </p>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-muted-foreground font-mono text-[11px]">
              {completeness.reasonsForRejection.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Missing Evidence & Warnings ({completeness.missingEvidence.length + completeness.warnings.length})</span>
          </div>
          {completeness.missingEvidence.length === 0 &&
          completeness.warnings.length === 0 ? (
            <p className="text-muted-foreground italic">
              No missing evidence records or warnings.
            </p>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-muted-foreground font-mono text-[11px]">
              {[...completeness.missingEvidence, ...completeness.warnings].map(
                (w, i) => (
                  <li key={i}>{w}</li>
                )
              )}
            </ul>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-blue-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Required Additional Evidence ({completeness.requiredAdditionalEvidence.length})</span>
          </div>
          {completeness.requiredAdditionalEvidence.length === 0 ? (
            <p className="text-muted-foreground italic">
              Evidence set satisfies all requirements for bounded state recovery.
            </p>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-muted-foreground font-mono text-[11px]">
              {completeness.requiredAdditionalEvidence.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
