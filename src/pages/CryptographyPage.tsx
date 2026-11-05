import React, { useState } from 'react';
import { CheckCircle2, Lock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import {
  canonicalJson,
  computeCanonicalCommitment,
  verifyMerkleInclusionProof,
} from '../services/cryptography';

export const CryptographyPage: React.FC = () => {
  const { workflowOutput, checkpoint } = useCausalChain();
  const [selectedLeafLabel, setSelectedLeafLabel] = useState<string>('KA');
  const [tamperLeafHash, setTamperLeafHash] = useState<boolean>(false);
  const [verificationMsg, setVerificationMsg] = useState<{
    valid: boolean;
    details: string;
  } | null>(null);

  if (!workflowOutput) return null;
  const { merkleTree, boundary, reconstruction, certificate } = workflowOutput;

  const activeProof =
    merkleTree.proofs[selectedLeafLabel] ??
    Object.values(merkleTree.proofs)[0] ??
    null;

  const handleIndependentVerify = async () => {
    if (!activeProof) return;
    const proofToTest = tamperLeafHash
      ? {
          ...activeProof,
          leafHash:
            '00000000000000000000000000000000000000000000000000000000tampered',
        }
      : activeProof;

    const valid = await verifyMerkleInclusionProof(proofToTest, merkleTree.root);
    const recomputedStateCommit = await computeCanonicalCommitment(
      reconstruction.reconstructedState
    );
    const commitMatches =
      recomputedStateCommit === reconstruction.reconstructedStateCommitment;

    setVerificationMsg({
      valid: valid && commitMatches,
      details:
        valid && commitMatches
          ? `Verified! Leaf "${proofToTest.leafLabel}" inclusion proof hashes deterministically to Merkle Root ${merkleTree.root.slice(0, 18)}... and canonical state commitment matches.`
          : `Verification FAILED! Tampered leaf digest or commitment does not match Merkle Root ${merkleTree.root.slice(0, 18)}...`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold">
            Cryptographic Commitment & Merkle Proof Engine (Module 17)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Uses Web Crypto API (<code className="font-mono">crypto.subtle.digest('SHA-256')</code>)
          and deterministic canonical JSON serialization. Note: A cryptographic hash guarantees
          data integrity against post-commitment tampering, but is never treated as proof of source
          authenticity or evidence completeness on its own.
        </p>
      </div>

      {/* Primary Commitments Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div className="bg-card border border-border rounded-lg p-4 space-y-1.5">
          <div className="text-muted-foreground">Checkpoint Commitment (CB)</div>
          <div className="text-blue-400 break-all">
            {checkpoint?.checkpointCommitment ?? 'N/A'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-1.5">
          <div className="text-muted-foreground">Causal Boundary Commitment (B)</div>
          <div className="text-amber-400 break-all">{boundary.boundaryCommitment}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-1.5">
          <div className="text-muted-foreground">Reconstructed-State Commitment (SB')</div>
          <div className="text-emerald-400 break-all">
            {reconstruction.reconstructedStateCommitment}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-1.5">
          <div className="text-muted-foreground">Merkle Tree Root</div>
          <div className="text-purple-400 break-all">{merkleTree.root}</div>
        </div>
      </div>

      {/* Interactive Merkle Proof Inspector & Verifier */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-semibold">
              Merkle Inclusion Proof Generator & Verifier
            </h3>
            <p className="text-xs text-muted-foreground">
              Select any state leaf to inspect its sibling authentication path and run independent Web Crypto verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedLeafLabel}
              onChange={(e) => setSelectedLeafLabel(e.target.value)}
              className="bg-background border border-border rounded px-3 py-1.5 text-xs font-mono"
            >
              {merkleTree.leaves.map((l) => (
                <option key={l.label} value={l.label}>
                  Leaf: {l.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs font-mono cursor-pointer px-2.5 py-1.5 rounded bg-secondary border border-border">
              <input
                type="checkbox"
                checked={tamperLeafHash}
                onChange={(e) => setTamperLeafHash(e.target.checked)}
              />
              Simulate Tampered Leaf
            </label>
            <button
              onClick={handleIndependentVerify}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recompute & Verify Proof
            </button>
          </div>
        </div>

        {verificationMsg && (
          <div
            className={`p-3.5 rounded border flex items-center gap-2.5 text-xs font-mono ${
              verificationMsg.valid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {verificationMsg.valid ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{verificationMsg.details}</span>
          </div>
        )}

        {activeProof && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-2">
              <div className="text-muted-foreground font-semibold">
                Merkle Inclusion Proof Path ({activeProof.steps.length} sibling hops):
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border space-y-1.5">
                <div>Leaf Label: {activeProof.leafLabel}</div>
                <div className="truncate text-blue-400">
                  Leaf Hash: {activeProof.leafHash}
                </div>
                {activeProof.steps.map((st, idx) => (
                  <div key={idx} className="truncate text-muted-foreground">
                    Hop #{idx + 1} ({st.position.toUpperCase()} sibling): {st.hash}
                  </div>
                ))}
                <div className="truncate text-purple-400 font-bold">
                  Target Root: {activeProof.rootHash}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground font-semibold">
                Canonical JSON Serialization Preview (Sorted Keys):
              </div>
              <pre className="p-3 rounded bg-background border border-border text-[11px] overflow-x-auto max-h-44">
                {canonicalJson(
                  reconstruction.reconstructedState.find(
                    (s) => s.stateId === activeProof.leafLabel
                  ) ?? certificate?.causalBoundary
                )}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
