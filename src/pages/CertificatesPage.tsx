import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileBadge,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { verifyCertificateIntegrity } from '../services/certificates';
import { downloadJsonFile } from '../services/storage';

export const CertificatesPage: React.FC = () => {
  const {
    workflowOutput,
    triggerCertificateTamperingDemo,
    runAnalysisOnCurrentEvidence,
  } = useCausalChain();

  const [copied, setCopied] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    commitmentMatches: boolean;
    recomputedCommitment: string;
    signatureValid: boolean;
  } | null>(null);

  if (!workflowOutput || !workflowOutput.certificate) {
    return (
      <div className="p-6 bg-card border border-border rounded-lg text-xs text-muted-foreground">
        No recovery certificate available. Load a scenario with an authenticated checkpoint.
      </div>
    );
  }

  const { certificate } = workflowOutput;

  const handleCopyHash = () => {
    navigator.clipboard?.writeText(certificate.certificateCommitment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyNow = async () => {
    const res = await verifyCertificateIntegrity(certificate);
    setCheckResult(res);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2">
            <FileBadge className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">
              Cryptographic Recovery Certificate Generator (Module 18)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Generates a deterministic SHA-256 commitment over the canonical certificate
            payload (excluding its own commitment field) and signs it using a locally
            generated Web Crypto ECDSA P-256 demo keypair.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleVerifyNow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Verify Certificate Commitment
          </button>
          <button
            data-testid="tamper-certificate-btn"
            onClick={async () => {
              await triggerCertificateTamperingDemo();
              setCheckResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-medium"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Simulate Post-Gen Tampering
          </button>
          <button
            onClick={async () => {
              await runAnalysisOnCurrentEvidence({ tamperCert: false });
              setCheckResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary hover:bg-accent border border-border text-xs font-medium"
          >
            Regenerate Clean Certificate
          </button>
          <button
            onClick={() =>
              downloadJsonFile(
                `recovery-certificate-${certificate.certificateId}.json`,
                certificate
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary hover:bg-accent border border-border text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Download JSON
          </button>
        </div>
      </div>

      {/* Verification Banner */}
      {checkResult && (
        <div
          className={`p-4 rounded-lg border flex items-start gap-3 text-xs font-mono ${
            checkResult.commitmentMatches && checkResult.signatureValid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {checkResult.commitmentMatches && checkResult.signatureValid ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <div className="space-y-1">
            <div className="font-bold">
              {checkResult.commitmentMatches && checkResult.signatureValid
                ? 'CERTIFICATE INTEGRITY & DEMO SIGNATURE VERIFIED'
                : 'CERTIFICATE TAMPERING DETECTED — COMMITMENT MISMATCH'}
            </div>
            <div>Recorded Commitment: {certificate.certificateCommitment}</div>
            <div>Recomputed Digest: {checkResult.recomputedCommitment}</div>
            <div>
              Web Crypto ECDSA Signature Valid: {String(checkResult.signatureValid)}
            </div>
          </div>
        </div>
      )}

      {/* Certificate Summary Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-card border border-border rounded-lg p-4 space-y-1.5">
          <div className="text-muted-foreground">Certificate ID & Protocol</div>
          <div className="font-mono font-bold text-blue-400">
            {certificate.certificateId} (v{certificate.protocolVersion})
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            Network: {certificate.network} ({certificate.ledgerId})
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Certificate Commitment (SHA-256)</span>
            <button
              onClick={handleCopyHash}
              className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy Hash'}
            </button>
          </div>
          <div className="font-mono text-[11px] break-all text-emerald-400">
            {certificate.certificateCommitment}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-1.5">
          <div className="text-muted-foreground">
            Authorization & Local Demo Signature Notice
          </div>
          <div className="font-mono font-bold text-amber-400">
            {certificate.authorization.status}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {certificate.authorization.signatureNotice}
          </div>
        </div>
      </div>

      {/* Formatted Certificate Payload */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Structured Recovery Certificate Payload (Canonical Schema)
          </span>
          <span className="font-mono text-[11px] text-blue-400">
            Transitions: {certificate.reconstruction.transitionCount} • Boundary:{' '}
            {certificate.causalBoundary.boundaryId}
          </span>
        </div>
        <pre className="p-5 bg-background font-mono text-[11px] overflow-x-auto max-h-[520px]">
          {JSON.stringify(certificate, null, 2)}
        </pre>
      </div>
    </div>
  );
};
