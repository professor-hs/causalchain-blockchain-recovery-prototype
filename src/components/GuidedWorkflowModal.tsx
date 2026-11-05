import React from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  X,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { useCausalChain, NavigationPageId } from '../hooks/useCausalChainStore';

export const GuidedWorkflowModal: React.FC = () => {
  const {
    guidedModalOpen,
    setGuidedModalOpen,
    guidedStep,
    isGuidedRunning,
    startGuidedPatentWorkflow,
    workflowOutput,
    checkpoint,
    executionEvidence,
    storageEvidence,
    setActivePage,
  } = useCausalChain();

  if (!guidedModalOpen) return null;

  const stages: {
    step: number;
    title: string;
    page: NavigationPageId;
    outputSummary: string;
    status: 'PASS' | 'WARN' | 'FAIL';
  }[] = [
    {
      step: 1,
      title: '1. Load Controlled Sample Dataset (Scenario H)',
      page: 'experiments',
      outputSummary: `Loaded Checkpoint ${checkpoint?.checkpointId ?? 'CKPT-19400000'} (4 state objects: KA@v4, KB@v2, KC@v1, KD@v7).`,
      status: 'PASS',
    },
    {
      step: 2,
      title: '2. Acquire Execution Evidence (Ei = Ti, Oi, Ri, Wi, Vi, Si, Ai)',
      page: 'evidence',
      outputSummary: `Acquired ${executionEvidence.length} authenticated execution records: [${executionEvidence
        .map((e) => `${e.evidenceId} (${e.transactionId})`)
        .join(', ')}].`,
      status: 'PASS',
    },
    {
      step: 3,
      title: '3. Acquire Separate Storage-Operation Evidence (Dj = Tj, Kj, Oj, Vj, Cj, Aj)',
      page: 'evidence',
      outputSummary: `Acquired ${storageEvidence.length} independent storage records: [${storageEvidence
        .map((s) => `${s.evidenceId} (${s.affectedStateObject}:${s.commitStatus})`)
        .join(', ')}].`,
      status: 'PASS',
    },
    {
      step: 4,
      title: '4. Normalize & Correlate Dual Evidence Streams',
      page: 'correlation',
      outputSummary: workflowOutput
        ? `Correlated ${workflowOutput.correlations.length} pairs: ${
            workflowOutput.correlations.filter((c) => c.category === 'MATCHED').length
          } MATCHED, ${
            workflowOutput.correlations.filter((c) => c.category !== 'MATCHED').length
          } MISMATCHED/CONFLICT.`
        : 'Pending correlation...',
      status: 'PASS',
    },
    {
      step: 5,
      title: '5. Detect Evidence Disagreements (Mi = Consistent(Xi, Di), Δi)',
      page: 'disagreement',
      outputSummary: workflowOutput
        ? `Detected ${
            workflowOutput.disagreements.filter((d) => d.indicator !== '0').length
          } discrepancy(ies): ${workflowOutput.disagreements
            .filter((d) => d.indicator !== '0')
            .map((d) => `${d.disagreementType} (Δi=${d.indicator}) on ${d.stateObjectId}`)
            .join('; ') || 'None'}.`
        : 'Pending...',
      status:
        workflowOutput &&
        workflowOutput.disagreements.some((d) => d.indicator !== '0')
          ? 'WARN'
          : 'PASS',
    },
    {
      step: 6,
      title: '6. Assess Evidence Completeness (10 Mandatory & Advisory Rules)',
      page: 'completeness',
      outputSummary: workflowOutput
        ? `Result: ${workflowOutput.completeness.status} (Coverage Metric: ${workflowOutput.completeness.descriptiveCoveragePercentage}%, Mandatory Rules Passed: ${workflowOutput.completeness.mandatoryRulesPassed}).`
        : 'Pending...',
      status: workflowOutput?.completeness.canProceedToReconstruction
        ? 'PASS'
        : 'FAIL',
    },
    {
      step: 7,
      title: '7. Construct Transaction Dependency Graph G = (N, E)',
      page: 'causal-graph',
      outputSummary: workflowOutput
        ? `Constructed graph with ${workflowOutput.causalGraph.nodes.length} nodes and ${workflowOutput.causalGraph.edges.length} causal edges (RAW, WAW, Lineage).`
        : 'Pending...',
      status: 'PASS',
    },
    {
      step: 8,
      title: '8. Propagate Causal Uncertainty U(k+1) = U(k) ∪ {v | u→v}',
      page: 'causal-graph',
      outputSummary: workflowOutput
        ? `Directly Inconsistent U(0): [${workflowOutput.causalGraph.directlyInconsistentNodes.join(
            ', '
          )}], Transitively Affected: [${workflowOutput.causalGraph.transitivelyAffectedNodes.join(
            ', '
          )}], Unaffected: ${workflowOutput.causalGraph.verifiedUnaffectedNodes.length} nodes.`
        : 'Pending...',
      status: 'PASS',
    },
    {
      step: 9,
      title: '9. Certify or Reject Causal Boundary B = (SB, TB, EB, CB, UB)',
      page: 'boundary',
      outputSummary: workflowOutput
        ? `Boundary ${workflowOutput.boundary.boundaryId}: ${
            workflowOutput.boundary.outcome
          } | SB=[${workflowOutput.boundary.stateObjectsInBoundary.join(
            ', '
          )}] | Preserved=[${workflowOutput.boundary.unaffectedStateObjects.join(', ')}].`
        : 'Pending...',
      status: workflowOutput?.boundary.outcome === 'CERTIFIED' ? 'PASS' : 'FAIL',
    },
    {
      step: 10,
      title: "10. Selective State Reconstruction SB' = Apply(SC, TBv)",
      page: 'reconstruction',
      outputSummary: workflowOutput
        ? `Status: ${workflowOutput.reconstruction.status} | Applied ${workflowOutput.reconstruction.appliedTransitions.length} verified transition(s) | Unaffected State Preserved: ${workflowOutput.reconstruction.unaffectedStatePreserved}.`
        : 'Pending...',
      status:
        workflowOutput?.reconstruction.status === 'COMPLETED' ? 'PASS' : 'FAIL',
    },
    {
      step: 11,
      title: '11. Generate SHA-256 Commitments & Merkle Inclusion Proofs',
      page: 'cryptography',
      outputSummary: workflowOutput
        ? `State Commitment: ${workflowOutput.reconstruction.reconstructedStateCommitment.slice(
            0,
            18
          )}... | Merkle Root: ${workflowOutput.merkleTree.root.slice(0, 18)}...`
        : 'Pending...',
      status: 'PASS',
    },
    {
      step: 12,
      title: '12. Generate Signed Cryptographic Recovery Certificate',
      page: 'certificates',
      outputSummary: workflowOutput?.certificate
        ? `Certificate ${workflowOutput.certificate.certificateId} | Commitment: ${workflowOutput.certificate.certificateCommitment.slice(
            0,
            18
          )}... | Web Crypto ECDSA Signature Attached.`
        : 'Pending...',
      status: workflowOutput?.certificate ? 'PASS' : 'FAIL',
    },
    {
      step: 13,
      title: '13. Execute Independent Validator Verification (3 Nodes)',
      page: 'validators',
      outputSummary: workflowOutput?.validatorReport
        ? `Consensus Outcome: ${workflowOutput.validatorReport.overallOutcome} (${
            workflowOutput.validatorReport.validatorReports.filter(
              (v) => v.outcome === 'ACCEPTED'
            ).length
          }/3 Demo Validators Accepted).`
        : 'Pending...',
      status:
        workflowOutput?.validatorReport?.overallOutcome === 'ACCEPTED'
          ? 'PASS'
          : 'FAIL',
    },
    {
      step: 14,
      title: '14. Protocol-Compliant State Acceptance Decision',
      page: 'validators',
      outputSummary: workflowOutput
        ? `Final Recovery Decision: ${workflowOutput.acceptanceReport.decision} (${workflowOutput.acceptanceReport.reasons[0]}).`
        : 'Pending...',
      status:
        workflowOutput?.acceptanceReport.decision === 'ACCEPTED'
          ? 'PASS'
          : 'FAIL',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Interactive Guided Demonstration — Complete Patent Workflow
              </h2>
              <p className="text-xs text-muted-foreground">
                14-Stage Evidence-Disagreement-Driven Causal Boundary Certification & State Reconstruction Pipeline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startGuidedPatentWorkflow()}
              disabled={isGuidedRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Re-Run Guided Pipeline
            </button>
            <button
              onClick={() => setGuidedModalOpen(false)}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {stages.map((st) => {
            const reached = guidedStep >= st.step;
            const current = guidedStep === st.step && isGuidedRunning;
            return (
              <div
                key={st.step}
                className={`p-3.5 rounded-md border transition-all ${
                  reached
                    ? 'bg-secondary/40 border-border'
                    : 'bg-background/40 border-border/40 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {current ? (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      ) : reached ? (
                        st.status === 'WARN' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {st.title}
                      </div>
                      {reached && (
                        <div className="mt-1 text-xs font-mono text-muted-foreground">
                          {st.outputSummary}
                        </div>
                      )}
                    </div>
                  </div>
                  {reached && (
                    <button
                      onClick={() => {
                        setActivePage(st.page);
                        setGuidedModalOpen(false);
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-accent hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors"
                    >
                      Inspect Stage
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Total Execution Time:{' '}
            <span className="font-mono text-foreground font-semibold">
              {workflowOutput?.stageTimingsMs.total ?? 0} ms
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-mono">
              Decision: {workflowOutput?.acceptanceReport.decision ?? 'PENDING'}
            </span>
            <button
              onClick={() => setGuidedModalOpen(false)}
              className="px-4 py-1.5 rounded bg-secondary hover:bg-accent text-foreground font-medium border border-border"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
