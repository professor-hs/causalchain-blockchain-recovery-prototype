import React from 'react';
import { BookOpen, Cpu, GitFork, Lock, ShieldCheck } from 'lucide-react';

export const DocumentationPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-card border border-border rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2 text-blue-400">
          <BookOpen className="w-5 h-5" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider">
            Invention Disclosure & Technical Specification (Module 27)
          </span>
        </div>
        <h2 className="text-lg font-bold">
          System and Method for Evidence-Disagreement-Driven Causal Boundary Certification
          and Cryptographically Verified State Reconstruction in Distributed Ledger Networks
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This research prototype implements a deterministic, evidence-driven recovery
          pipeline for distributed ledger nodes experiencing divergence or incomplete
          persistence between their execution engine and underlying key-value storage engine.
          Rather than rolling back entire blocks or blindly re-executing unaffected state,
          CAUSALCHAIN isolates the exact causal cone of uncertainty, certifies a minimal
          causal boundary, reconstructs only affected state objects from an authenticated
          checkpoint, and generates a cryptographically verifiable recovery certificate.
        </p>
      </div>

      {/* Mathematical Representations & Tuple Definitions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-card border border-border rounded-lg p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-blue-400">
            <Cpu className="w-4 h-4" />
            <span>1. Execution & Storage Evidence Tuples</span>
          </div>
          <div className="p-3 rounded bg-secondary/40 border border-border font-mono space-y-1.5 text-[11px]">
            <div>
              <strong>Execution Evidence:</strong> Ei = (Ti, Oi, Ri, Wi, Vi, Si, Ai)
            </div>
            <div className="text-muted-foreground">
              Ti: Transaction ID • Oi: Execution Sequence • Ri: State Reads • Wi: State
              Writes • Vi: Version Transition • Si: Outcome • Ai: Authentication
            </div>
            <div className="pt-2">
              <strong>Storage Evidence:</strong> Dj = (Tj, Kj, Oj, Vj, Cj, Aj)
            </div>
            <div className="text-muted-foreground">
              Tj: Associated Tx ID • Kj: Affected State Object • Oj: Storage Ordering •
              Vj: Resulting State Version • Cj: Commit Status • Aj: Auth Metadata
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <GitFork className="w-4 h-4" />
            <span>2. Disagreement Predicate & Causal Propagation</span>
          </div>
          <div className="p-3 rounded bg-secondary/40 border border-border font-mono space-y-1.5 text-[11px]">
            <div>
              <strong>Consistency Predicate:</strong> Mi = Consistent(Xi, Di)
            </div>
            <div>
              <strong>Disagreement Indicator:</strong> Δi ∈ {'{0, 1, ⊥}'}
            </div>
            <div className="text-muted-foreground">
              0 = Consistent • 1 = Confirmed Disagreement • ⊥ = Indeterminate / Missing
            </div>
            <div className="pt-2">
              <strong>Causal Propagation over G = (N, E):</strong>
            </div>
            <div className="text-emerald-400">
              U(k+1) = U(k) ∪ {'{v | ∃ u ∈ U(k) ∧ (u → v) ∈ E}'}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>3. Causal Boundary & Selective Reconstruction</span>
          </div>
          <div className="p-3 rounded bg-secondary/40 border border-border font-mono space-y-1.5 text-[11px]">
            <div>
              <strong>Causal Boundary Tuple:</strong> B = (SB, TB, EB, CB, UB)
            </div>
            <div className="text-muted-foreground">
              SB: Affected State Objects • TB: Relevant Transactions • EB: Dependency
              Edges • CB: Authenticated Checkpoint • UB: Unresolved Uncertainty
            </div>
            <div className="pt-2">
              <strong>Selective State Reconstruction:</strong>
            </div>
            <div className="text-blue-400">SB' = Apply(SC, TBv)</div>
            <div className="text-muted-foreground">
              Preserves ∀ k ∉ SB: State_After(k) === State_Checkpoint(k)
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-purple-400">
            <Lock className="w-4 h-4" />
            <span>4. Commitments, Certificates & Validator Consensus</span>
          </div>
          <div className="p-3 rounded bg-secondary/40 border border-border font-mono space-y-1.5 text-[11px]">
            <div>
              <strong>Canonical Commitment:</strong> H(x) = SHA256(CanonicalJSON(x))
            </div>
            <div>
              <strong>Merkle Root:</strong> Domain-separated LEAF: and NODE: SHA-256 tree
            </div>
            <div className="text-muted-foreground pt-1">
              Independent validators recompute checkpoint commitments, evidence hashes,
              reconstructed state digests, and Merkle inclusion proofs rather than
              trusting the certificate hash alone.
            </div>
          </div>
        </div>
      </div>

      {/* Architecture & Workflow Diagram */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-bold">
          12-Stage System Architecture & Recovery Pipeline Diagram
        </h3>
        <pre className="p-4 rounded bg-slate-950 border border-border font-mono text-[11px] text-blue-300 overflow-x-auto leading-relaxed">
{`[1. Execution Evidence Ei] ──┐
                             ├──► [3. Normalization & Correlation] ──► [4. Disagreement Detection Δi ∈ {0,1,⊥}]
[2. Storage Evidence Dj]  ───┘                                                      │
                                                                                    ▼
[Authenticated Checkpoint CB] ──► [5. Completeness Assessment (10 Rules)] ◄─────────┘
             │                                    │
             ▼                                    ▼
[8. Selective Reconstruction] ◄── [7. Boundary Certification B=(SB,TB,EB,CB,UB)] ◄── [6. BFS Causal Graph G=(N,E)]
      SB' = Apply(SC, TBv)
             │
             ▼
[9. Web Crypto SHA-256 & Merkle Tree] ──► [10. Signed Recovery Certificate] ──► [11. Independent Validators (3x)]
                                                                                           │
                                                                                           ▼
                                                                           [12. Protocol Acceptance Controller]`}
        </pre>
      </div>

      {/* Distinction & Limitations Table */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3 text-xs">
        <h3 className="text-sm font-bold">
          Provenance Distinction & Current Prototype Limitations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded bg-secondary/30 border border-border space-y-1">
            <div className="font-semibold text-emerald-400">
              Real Public Blockchain Data (PublicNode JSON-RPC)
            </div>
            <p className="text-muted-foreground">
              Block headers, parent hashes, transaction envelopes, gas used, transaction
              status, receipt logs, and top-level account state queries are retrieved live
              from Ethereum Mainnet and Sepolia without requiring paid API keys.
            </p>
          </div>
          <div className="p-3 rounded bg-secondary/30 border border-border space-y-1">
            <div className="font-semibold text-amber-400">
              Inferred Fields vs Simulated Storage Evidence
            </div>
            <p className="text-muted-foreground">
              Because standard public JSON-RPC does not expose internal EVM storage engine
              WAL/commit logs, imported live transactions have internal version transitions
              labeled <code className="font-mono">LIVE_RPC_INFERRED</code> and storage
              commit logs marked <code className="font-mono">UNAVAILABLE</code>. Controlled
              storage-operation evidence is generated only in the experimental simulator.
            </p>
          </div>
          <div className="p-3 rounded bg-secondary/30 border border-border space-y-1">
            <div className="font-semibold text-blue-400">
              Local Demo Signatures & Validators
            </div>
            <p className="text-muted-foreground">
              Recovery certificates are signed with locally generated Web Crypto ECDSA P-256
              demo keypairs, and verified by three independent local verification engines.
              They do not represent Ethereum mainnet consensus validator signatures.
            </p>
          </div>
          <div className="p-3 rounded bg-secondary/30 border border-border space-y-1">
            <div className="font-semibold text-purple-400">
              Non-Destructive Operational Recovery
            </div>
            <p className="text-muted-foreground">
              Selective state reconstruction operates on local operational state from an
              authenticated checkpoint and never rewrites finalized Ethereum mainnet history.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
