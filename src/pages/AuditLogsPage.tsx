import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  History,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { verifyAuditChainIntegrity } from '../services/audit';
import { downloadJsonFile } from '../services/storage';

export const AuditLogsPage: React.FC = () => {
  const { auditLogs } = useCausalChain();
  const [verificationStatus, setVerificationStatus] = useState<{
    valid: boolean;
    verifiedCount: number;
    reason: string;
  } | null>(null);

  const handleVerifyChain = async () => {
    const res = await verifyAuditChainIntegrity(auditLogs);
    setVerificationStatus(res);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">
              Append-Only Hash-Linked Application Audit Log (Module 23)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Records every evidence acquisition, correlation, disagreement detection,
            completeness check, boundary certification, reconstruction, certificate
            generation, and validator decision in a SHA-256 hash-linked chain from genesis.
            <strong className="text-foreground ml-1">
              Note: This provides application-level tamper-evident logging, not a guarantee against a privileged local operator rewriting all browser storage from genesis.
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            data-testid="verify-audit-chain-btn"
            onClick={handleVerifyChain}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Hash-Linked Audit Chain
          </button>
          <button
            onClick={() => downloadJsonFile('causalchain-audit-log.json', auditLogs)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-secondary hover:bg-accent border border-border text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit Log
          </button>
        </div>
      </div>

      {verificationStatus && (
        <div
          className={`p-4 rounded-lg border flex items-center gap-3 text-xs font-mono ${
            verificationStatus.valid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {verificationStatus.valid ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <div>
            <div className="font-bold">
              {verificationStatus.valid
                ? 'AUDIT CHAIN INTEGRITY VERIFIED FROM GENESIS'
                : 'AUDIT CHAIN TAMPERING DETECTED'}
            </div>
            <div>{verificationStatus.reason}</div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground uppercase">
                <th className="py-3 px-4">Seq / Event ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Summary</th>
                <th className="py-3 px-4">Previous Hash</th>
                <th className="py-3 px-4">Current SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {auditLogs.map((entry) => (
                <tr key={entry.eventId} className="hover:bg-secondary/20">
                  <td className="py-3 px-4 text-blue-400 font-bold">
                    #{entry.sequence} ({entry.eventId})
                  </td>
                  <td className="py-3 px-4 text-[11px] text-muted-foreground">
                    {entry.timestamp}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-accent text-[10px]">
                      {entry.eventType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-sans text-xs">{entry.summary}</td>
                  <td className="py-3 px-4 text-[10px] text-muted-foreground">
                    {entry.previousAuditHash.slice(0, 14)}...
                  </td>
                  <td className="py-3 px-4 text-[10px] text-emerald-400">
                    {entry.currentAuditHash.slice(0, 18)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
