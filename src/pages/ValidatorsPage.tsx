import React from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Upload,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { RecoveryCertificate } from '../types';

export const ValidatorsPage: React.FC = () => {
  const {
    workflowOutput,
    validatorPolicy,
    setValidatorPolicy,
    verifyUploadedCertificate,
  } = useCausalChain();

  if (!workflowOutput) return null;
  const { validatorReport, acceptanceReport } = workflowOutput;

  const handleUploadCertificate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(
          String(ev.target?.result || '')
        ) as RecoveryCertificate;
        await verifyUploadedCertificate(parsed);
      } catch {
        // Ignore invalid JSON
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header & Policy Controls */}
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">
              Independent Validator Verification & Protocol Acceptance (Modules 19 & 20)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Three independent demo verification nodes (<code className="font-mono">VAL-ALPHA-01</code>,{' '}
            <code className="font-mono">VAL-BETA-02</code>, <code className="font-mono">VAL-GAMMA-03</code>)
            independently recompute evidence hashes, checkpoint commitments, reconstructed state commitments,
            and Merkle proofs. Note: These are independent local verification routines, not mainnet consensus participants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={validatorPolicy}
            onChange={(e) =>
              setValidatorPolicy(
                e.target.value as 'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3'
              )
            }
            className="bg-secondary border border-border rounded px-3 py-1.5 text-xs font-mono"
          >
            <option value="UNANIMOUS_3_OF_3">Policy: Unanimous (3 of 3)</option>
            <option value="MAJORITY_2_OF_3">Policy: Majority (2 of 3)</option>
          </select>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Upload Certificate JSON to Verify
            <input
              type="file"
              accept=".json"
              onChange={handleUploadCertificate}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Protocol-Compliant State Acceptance Controller (Module 20) */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-bold">
              Protocol-Compliant State Acceptance Controller (Final Recovery Decision)
            </h3>
            <p className="text-xs text-muted-foreground">
              Evaluates all 7 mandatory protocol conditions before accepting proposed operational state recovery.
            </p>
          </div>
          <span
            data-testid="validator-page-decision"
            className={`px-4 py-1.5 rounded border font-mono text-sm font-bold ${
              acceptanceReport.decision === 'ACCEPTED'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : acceptanceReport.decision === 'SUSPENDED'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}
          >
            RECOVERY {acceptanceReport.decision}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {Object.entries(acceptanceReport.conditions).map(([cond, passed]) => (
            <div
              key={cond}
              className="p-3 rounded bg-secondary/40 border border-border flex items-center justify-between gap-2"
            >
              <span className="font-mono text-[11px] truncate">{cond}</span>
              {passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="p-3 rounded bg-secondary/30 border border-border text-xs font-mono space-y-1">
          {acceptanceReport.reasons.map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      </div>

      {/* 3 Independent Demo Validator Reports */}
      {validatorReport && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {validatorReport.validatorReports.map((val) => (
            <div
              key={val.validatorId}
              className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <div className="font-mono text-xs font-bold text-blue-400">
                      {val.validatorId}
                    </div>
                    <div className="text-xs font-semibold mt-0.5">
                      {val.validatorName}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${
                      val.outcome === 'ACCEPTED'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : val.outcome === 'INDETERMINATE'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {val.outcome}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {val.profileDescription}
                </p>

                <div className="space-y-1.5">
                  {val.checks.map((chk, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-secondary/30 border border-border/70 text-[11px]"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span>{chk.checkName}</span>
                        {chk.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {chk.details}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {val.failedReasons.length > 0 && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] font-mono text-rose-300 space-y-1">
                  <div className="flex items-center gap-1 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Rejection Reasons:</span>
                  </div>
                  {val.failedReasons.map((fr, i) => (
                    <div key={i}>• {fr}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
