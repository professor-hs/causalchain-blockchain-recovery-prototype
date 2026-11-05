import {
  BoundaryCertificationOutcome,
  CausalBoundary,
  CausalGraphResult,
  CheckpointRecord,
  CompletenessAssessment,
  DisagreementRecord,
  ExecutionEvidence,
} from '../../types';
import { verifyCheckpointIntegrity } from '../completeness';
import { computeCanonicalCommitment } from '../cryptography';

export interface BoundaryPolicyConfig {
  allowConservativeProvisionalBoundary: boolean;
}

export const DEFAULT_BOUNDARY_POLICY: BoundaryPolicyConfig = {
  allowConservativeProvisionalBoundary: true,
};

/**
 * Certify, mark Provisional, or Reject the Causal Boundary B = (SB, TB, EB, CB, UB).
 */
export async function certifyCausalBoundary(
  checkpoint: CheckpointRecord | null,
  executionEvidence: ExecutionEvidence[],
  disagreements: DisagreementRecord[],
  completeness: CompletenessAssessment,
  causalGraph: CausalGraphResult,
  policy: BoundaryPolicyConfig = DEFAULT_BOUNDARY_POLICY
): Promise<CausalBoundary> {
  const checkpointCheck = await verifyCheckpointIntegrity(checkpoint);

  // Collect all affected nodes U = U(0) ∪ U(1..k)
  const affectedNodeIds = new Set<string>([
    ...causalGraph.directlyInconsistentNodes,
    ...causalGraph.transitivelyAffectedNodes,
  ]);

  const stateObjectsSet = new Set<string>();
  const relevantTxSet = new Set<string>();

  for (const node of causalGraph.nodes) {
    if (affectedNodeIds.has(node.id)) {
      if (node.stateObjectId) stateObjectsSet.add(node.stateObjectId);
      if (node.transactionId) relevantTxSet.add(node.transactionId);
    }
  }

  for (const d of disagreements) {
    if (d.indicator !== '0') {
      stateObjectsSet.add(d.stateObjectId);
      relevantTxSet.add(d.transactionId);
    }
  }

  // Ensure any transaction that modifies a state object inside SB after the checkpoint is included in TB
  // so that SB can be deterministically reconstructed from the checkpoint SC.
  for (const exec of executionEvidence) {
    const touchesBoundaryState = exec.stateObjectsWritten.some((w) =>
      stateObjectsSet.has(w.stateId)
    );
    if (touchesBoundaryState) {
      relevantTxSet.add(exec.transactionId);
    }
  }

  const stateObjectsInBoundary = Array.from(stateObjectsSet).sort();
  const allCheckpointStates = checkpoint
    ? checkpoint.stateObjects.map((s) => s.stateId).sort()
    : [];
  const unaffectedStateObjects = allCheckpointStates.filter(
    (s) => !stateObjectsSet.has(s)
  );
  const relevantTransactions = Array.from(relevantTxSet).sort();

  const dependencyRelationships = causalGraph.edges.filter(
    (e) => affectedNodeIds.has(e.source) || affectedNodeIds.has(e.target)
  );

  // Unresolved uncertainty UB: any disagreement with Δi = ⊥ or unresolvable Δi = 1
  const unresolvedUncertainty: string[] = [];
  for (const d of disagreements) {
    if (d.indicator === '⊥') {
      unresolvedUncertainty.push(
        `${d.disagreementId}: Indeterminate (${d.subClassification}) on ${d.stateObjectId} in ${d.transactionId}`
      );
    } else if (d.indicator === '1' && !d.resolvableFromEvidence) {
      unresolvedUncertainty.push(
        `${d.disagreementId}: Unresolvable ${d.disagreementType} on ${d.stateObjectId} in ${d.transactionId}`
      );
    }
  }
  for (const uNodeId of causalGraph.unresolvedDependencyNodes) {
    const node = causalGraph.nodes.find((n) => n.id === uNodeId);
    if (node && node.nodeType === 'UNCERTAIN_DEPENDENCY') {
      unresolvedUncertainty.push(`Missing dependency lineage: ${node.label}`);
    }
  }

  const mandatoryEvidenceSatisfied = completeness.mandatoryRulesPassed;
  const suitableCheckpointAvailable = Boolean(checkpoint && checkpoint.authenticated);
  const checkpointIntegrityVerified = checkpointCheck.valid;
  const noUnresolvedCriticalUncertainty = unresolvedUncertainty.length === 0;
  const dependenciesResolvedOrCovered =
    causalGraph.unresolvedDependencyNodes.length === 0 ||
    policy.allowConservativeProvisionalBoundary;
  const allAffectedStateIncluded = Array.from(affectedNodeIds).every((id) => {
    const n = causalGraph.nodes.find((node) => node.id === id);
    return !n?.stateObjectId || stateObjectsSet.has(n.stateObjectId);
  });

  let outcome: BoundaryCertificationOutcome = 'REJECTED';
  let certificationExplanation = '';

  if (!suitableCheckpointAvailable || !checkpointIntegrityVerified) {
    outcome = 'REJECTED';
    certificationExplanation = `Boundary REJECTED: ${checkpointCheck.reason}`;
  } else if (
    mandatoryEvidenceSatisfied &&
    noUnresolvedCriticalUncertainty &&
    allAffectedStateIncluded
  ) {
    outcome = 'CERTIFIED';
    if (stateObjectsInBoundary.length === 0) {
      certificationExplanation =
        'Boundary CERTIFIED (Zero-Discrepancy Empty Boundary): All execution and storage evidence records match; no state objects are affected and no state reconstruction is required.';
    } else {
      certificationExplanation = `Boundary CERTIFIED: All mandatory evidence requirements satisfied, checkpoint ${checkpoint!.checkpointId} verified, and causal uncertainty is bounded to SB=[${stateObjectsInBoundary.join(', ')}] across TB=[${relevantTransactions.join(', ')}] while preserving [${unaffectedStateObjects.join(', ')}].`;
    }
  } else if (
    suitableCheckpointAvailable &&
    checkpointIntegrityVerified &&
    allAffectedStateIncluded &&
    policy.allowConservativeProvisionalBoundary &&
    disagreements.every((d) => d.disagreementType !== 'STORAGE_WITHOUT_EXECUTION' && d.disagreementType !== 'VERSION_CONFLICT')
  ) {
    outcome = 'PROVISIONAL';
    certificationExplanation = `Boundary marked PROVISIONAL: Conservative causal boundary SB=[${stateObjectsInBoundary.join(', ')}] isolates affected transactions TB=[${relevantTransactions.join(', ')}], but reconstruction is suspended pending resolution of ${unresolvedUncertainty.length} evidence gap(s).`;
  } else {
    outcome = 'REJECTED';
    const reasons: string[] = [];
    if (!mandatoryEvidenceSatisfied) {
      reasons.push(...completeness.reasonsForRejection);
    }
    if (!noUnresolvedCriticalUncertainty) {
      reasons.push(`${unresolvedUncertainty.length} unresolved critical uncertainty item(s).`);
    }
    certificationExplanation = `Boundary REJECTED: ${reasons.join(' ')}`;
  }

  const boundaryId = `BND-${Date.now().toString(36).toUpperCase()}`;
  const createdAt = new Date().toISOString();

  const boundaryCommitment = await computeCanonicalCommitment({
    boundaryId,
    outcome,
    stateObjectsInBoundary,
    unaffectedStateObjects,
    relevantTransactions,
    authenticatedCheckpointId: checkpoint?.checkpointId ?? 'NONE',
    checkpointCommitment: checkpoint?.checkpointCommitment ?? 'NONE',
    unresolvedUncertainty,
  });

  return {
    boundaryId,
    createdAt,
    outcome,
    stateObjectsInBoundary,
    unaffectedStateObjects,
    relevantTransactions,
    dependencyRelationships,
    authenticatedCheckpointId: checkpoint?.checkpointId ?? 'NONE',
    checkpointCommitment: checkpoint?.checkpointCommitment ?? 'NONE',
    unresolvedUncertainty,
    boundaryCommitment,
    certificationExplanation,
    mandatoryChecks: {
      mandatoryEvidenceSatisfied,
      dependenciesResolvedOrCovered,
      suitableCheckpointAvailable,
      checkpointIntegrityVerified,
      noUnresolvedCriticalUncertainty,
      allAffectedStateIncluded,
    },
  };
}
