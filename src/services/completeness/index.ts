import {
  CheckpointRecord,
  CompletenessAssessment,
  CompletenessRuleResult,
  CorrelationRecord,
  DisagreementRecord,
  ExecutionEvidence,
  StorageEvidence,
  SufficiencyStatus,
} from '../../types';
import { computeCheckpointCommitment, computeStateObjectHash } from '../cryptography';

export interface CompletenessRuleConfig {
  requireAuthenticatedExecution: boolean;
  requireCheckpointAuthentication: boolean;
  requireContiguousExecutionSequence: boolean;
  allowConditionalRecoveryWithResolvableDisagreements: boolean;
}

export const DEFAULT_COMPLETENESS_CONFIG: CompletenessRuleConfig = {
  requireAuthenticatedExecution: true,
  requireCheckpointAuthentication: true,
  requireContiguousExecutionSequence: true,
  allowConditionalRecoveryWithResolvableDisagreements: true,
};

/**
 * Verify checkpoint cryptographic integrity against its commitment and state object hashes.
 */
export async function verifyCheckpointIntegrity(checkpoint: CheckpointRecord | null): Promise<{
  valid: boolean;
  reason: string;
}> {
  if (!checkpoint || !checkpoint.checkpointId || checkpoint.stateObjects.length === 0) {
    return { valid: false, reason: 'No authenticated checkpoint loaded.' };
  }
  if (!checkpoint.authenticated) {
    return { valid: false, reason: `Checkpoint ${checkpoint.checkpointId} is not marked authenticated.` };
  }

  for (const s of checkpoint.stateObjects) {
    const recomputedStateHash = await computeStateObjectHash(s);
    if (recomputedStateHash !== s.integrityHash) {
      return {
        valid: false,
        reason: `State object ${s.stateId} inside checkpoint ${checkpoint.checkpointId} failed integrity hash verification (expected ${s.integrityHash.slice(0, 12)}..., computed ${recomputedStateHash.slice(0, 12)}...).`,
      };
    }
  }

  const recomputedCommitment = await computeCheckpointCommitment(checkpoint);
  if (recomputedCommitment !== checkpoint.checkpointCommitment) {
    return {
      valid: false,
      reason: `Checkpoint ${checkpoint.checkpointId} commitment mismatch (expected ${checkpoint.checkpointCommitment.slice(0, 12)}..., computed ${recomputedCommitment.slice(0, 12)}...).`,
    };
  }

  return { valid: true, reason: `Checkpoint ${checkpoint.checkpointId} cryptographic commitment verified.` };
}

/**
 * Rule-based Evidence Completeness Assessment Engine.
 * A high descriptive coverage percentage NEVER overrides a failed mandatory rule.
 */
export async function assessEvidenceCompleteness(
  executionEvidence: ExecutionEvidence[],
  storageEvidence: StorageEvidence[],
  correlations: CorrelationRecord[],
  disagreements: DisagreementRecord[],
  checkpoint: CheckpointRecord | null,
  config: CompletenessRuleConfig = DEFAULT_COMPLETENESS_CONFIG
): Promise<CompletenessAssessment> {
  const ruleResults: CompletenessRuleResult[] = [];
  const missingEvidence: string[] = [];
  const warnings: string[] = [];
  const reasonsForRejection: string[] = [];
  const requiredAdditionalEvidence: string[] = [];

  // Rule 1: Evidence Authentication (Mandatory)
  const invalidAuthExec = executionEvidence.filter(
    (e) =>
      e.authenticationStatus === 'INVALID_SIGNATURE' ||
      (config.requireAuthenticatedExecution && e.authenticationStatus !== 'AUTHENTICATED')
  );
  const invalidAuthStor = storageEvidence.filter(
    (s) => s.authenticationStatus === 'INVALID_SIGNATURE'
  );
  const authPassed =
    executionEvidence.length > 0 &&
    invalidAuthExec.length === 0 &&
    invalidAuthStor.length === 0;
  ruleResults.push({
    ruleId: 'RULE-01',
    ruleName: 'Evidence Authentication',
    mandatory: true,
    passed: authPassed,
    status: authPassed ? 'PASS' : 'FAIL',
    details: authPassed
      ? `All ${executionEvidence.length} execution records and ${storageEvidence.length} storage records passed authentication validation.`
      : `Failed authentication on ${invalidAuthExec.length} execution record(s) and ${invalidAuthStor.length} storage record(s).`,
  });
  if (!authPassed) {
    reasonsForRejection.push('Mandatory evidence authentication requirement failed.');
    requiredAdditionalEvidence.push('Cryptographically authenticated execution and storage records.');
  }

  // Rule 2: Record Coverage (Mandatory baseline presence + dual-stream coverage)
  const unmatchedExec = correlations.filter((c) => c.category === 'EXECUTION_WITHOUT_STORAGE');
  const unmatchedStor = correlations.filter((c) => c.category === 'STORAGE_WITHOUT_EXECUTION');
  const hasRecords = executionEvidence.length > 0 && correlations.length > 0;
  const fullDualCoverage =
    hasRecords && unmatchedExec.length === 0 && unmatchedStor.length === 0;
  ruleResults.push({
    ruleId: 'RULE-02',
    ruleName: 'Record Coverage',
    mandatory: true,
    passed: fullDualCoverage,
    status: fullDualCoverage ? 'PASS' : 'FAIL',
    details: fullDualCoverage
      ? `Complete cross-stream record coverage across ${correlations.length} correlated operations.`
      : `Incomplete record coverage: ${unmatchedExec.length} execution write(s) missing storage evidence, ${unmatchedStor.length} storage write(s) missing execution evidence.`,
  });
  for (const u of unmatchedExec) {
    missingEvidence.push(
      `Missing storage-operation record for transaction ${u.transactionId} on state ${u.stateObjectId} (expected v${u.expectedVersion}).`
    );
    requiredAdditionalEvidence.push(
      `Authenticated storage evidence for (${u.transactionId}, ${u.stateObjectId}).`
    );
  }
  for (const u of unmatchedStor) {
    missingEvidence.push(
      `Missing execution evidence for storage write (${u.storageEvidenceId}) on state ${u.stateObjectId} in ${u.transactionId}.`
    );
    requiredAdditionalEvidence.push(
      `Authenticated execution trace/evidence for transaction ${u.transactionId}.`
    );
  }
  if (!fullDualCoverage) {
    if (unmatchedExec.length > 0) {
      reasonsForRejection.push(
        `Missing storage evidence: ${unmatchedExec.length} execution write(s) lack corresponding storage records.`
      );
    }
    if (unmatchedStor.length > 0) {
      reasonsForRejection.push(
        `Missing execution evidence: ${unmatchedStor.length} unverified storage operation(s) without execution records.`
      );
    }
  }

  // Rule 3: Missing Sequence Numbers (Mandatory)
  const seqs = [...new Set(executionEvidence.map((e) => e.executionSequence))].sort(
    (a, b) => a - b
  );
  const missingSeqs: number[] = [];
  if (seqs.length > 0) {
    const minSeq = seqs[0];
    const maxSeq = seqs[seqs.length - 1];
    for (let s = minSeq; s <= maxSeq; s++) {
      if (!seqs.includes(s)) missingSeqs.push(s);
    }
  }
  const seqPassed = seqs.length > 0 && missingSeqs.length === 0;
  ruleResults.push({
    ruleId: 'RULE-03',
    ruleName: 'Missing Sequence Numbers',
    mandatory: config.requireContiguousExecutionSequence,
    passed: seqPassed,
    status: seqPassed ? 'PASS' : 'FAIL',
    details: seqPassed
      ? `Contiguous execution sequence verified (${seqs[0]}..${seqs[seqs.length - 1]}).`
      : `Sequence gaps detected: missing sequence number(s) [${missingSeqs.join(', ')}].`,
  });
  if (!seqPassed) {
    reasonsForRejection.push(`Execution sequence gap(s) detected: [${missingSeqs.join(', ')}].`);
    requiredAdditionalEvidence.push(`Execution evidence for sequence number(s) ${missingSeqs.join(', ')}.`);
  }

  // Rule 4: Ordering Continuity
  const orderingConflicts = correlations.filter((c) => c.category === 'ORDERING_MISMATCH');
  const orderingPassed = orderingConflicts.length === 0;
  ruleResults.push({
    ruleId: 'RULE-04',
    ruleName: 'Ordering Continuity',
    mandatory: false,
    passed: orderingPassed,
    status: orderingPassed ? 'PASS' : 'WARN',
    details: orderingPassed
      ? 'Execution sequence and storage operation ordering are continuous and aligned.'
      : `${orderingConflicts.length} ordering mismatch(es) detected between execution and storage streams.`,
  });
  if (!orderingPassed) {
    warnings.push(
      `${orderingConflicts.length} ordering discrepancy(ies) detected: [${orderingConflicts
        .map((o) => o.transactionId)
        .join(', ')}].`
    );
  }

  // Rule 5: State-Version Availability (Mandatory)
  const missingVersions = executionEvidence.filter(
    (e) =>
      e.stateObjectsWritten.some(
        (w) =>
          typeof w.previousVersion !== 'number' ||
          typeof w.resultingVersion !== 'number' ||
          w.resultingVersion < w.previousVersion
      )
  );
  const versionAvailPassed = executionEvidence.length > 0 && missingVersions.length === 0;
  ruleResults.push({
    ruleId: 'RULE-05',
    ruleName: 'State-Version Availability',
    mandatory: true,
    passed: versionAvailPassed,
    status: versionAvailPassed ? 'PASS' : 'FAIL',
    details: versionAvailPassed
      ? 'All state read and write records contain explicit pre-transition and post-transition version numbers.'
      : `${missingVersions.length} execution record(s) have missing or invalid state version numbers.`,
  });
  if (!versionAvailPassed) {
    reasonsForRejection.push('Missing or non-monotonic state-version transition metadata.');
  }

  // Rule 6: Transaction Identifier Consistency (Mandatory)
  const invalidTxIds = correlations.filter(
    (c) => !c.transactionId || c.transactionId === 'UNKNOWN'
  );
  const txIdPassed = correlations.length > 0 && invalidTxIds.length === 0;
  ruleResults.push({
    ruleId: 'RULE-06',
    ruleName: 'Transaction Identifier Consistency',
    mandatory: true,
    passed: txIdPassed,
    status: txIdPassed ? 'PASS' : 'FAIL',
    details: txIdPassed
      ? 'All correlated records map to deterministic, non-ambiguous transaction identifiers.'
      : `${invalidTxIds.length} record(s) contain unbound or UNKNOWN transaction identifiers.`,
  });
  if (!txIdPassed) {
    reasonsForRejection.push('Ambiguous or unbound transaction identifiers in evidence set.');
  }

  // Rule 7: Checkpoint Availability & Cryptographic Integrity (Mandatory)
  const checkpointCheck = await verifyCheckpointIntegrity(checkpoint);
  ruleResults.push({
    ruleId: 'RULE-07',
    ruleName: 'Checkpoint Availability & Integrity',
    mandatory: true,
    passed: checkpointCheck.valid,
    status: checkpointCheck.valid ? 'PASS' : 'FAIL',
    details: checkpointCheck.reason,
  });
  if (!checkpointCheck.valid) {
    reasonsForRejection.push(`Checkpoint requirement failed: ${checkpointCheck.reason}`);
    requiredAdditionalEvidence.push('Authenticated checkpoint with verified SHA-256 state commitment.');
  }

  // Rule 8: Dependency Information Completeness (Mandatory)
  // Verify that every state version read by a transaction exists either in the checkpoint or a prior execution write
  const availableStateVersions = new Set<string>();
  if (checkpoint) {
    for (const s of checkpoint.stateObjects) {
      availableStateVersions.add(`${s.stateId}@v${s.stateVersion}`);
    }
  }
  const sortedExec = [...executionEvidence].sort(
    (a, b) => a.executionSequence - b.executionSequence
  );
  const unresolvedReads: string[] = [];
  for (const exec of sortedExec) {
    for (const r of exec.stateObjectsRead) {
      const key = `${r.stateId}@v${r.versionRead}`;
      if (!availableStateVersions.has(key)) {
        unresolvedReads.push(`${exec.transactionId} reads ${key} (missing lineage predecessor)`);
      }
    }
    for (const w of exec.stateObjectsWritten) {
      availableStateVersions.add(`${w.stateId}@v${w.resultingVersion}`);
    }
  }
  const depPassed = unresolvedReads.length === 0;
  ruleResults.push({
    ruleId: 'RULE-08',
    ruleName: 'Dependency Information',
    mandatory: true,
    passed: depPassed,
    status: depPassed ? 'PASS' : 'FAIL',
    details: depPassed
      ? 'All read-after-write and state-version lineage dependencies resolve to checkpoint or prior verified transitions.'
      : `Unresolved dependency lineage: ${unresolvedReads.join('; ')}.`,
  });
  if (!depPassed) {
    reasonsForRejection.push(`Unresolved state dependency lineage: ${unresolvedReads.join(', ')}.`);
    requiredAdditionalEvidence.push('Predecessor execution evidence or checkpoint covering read state versions.');
  }

  // Rule 9: Unresolved Discrepancies (Mandatory for unresolvable conflicts)
  const unresolvableDisagreements = disagreements.filter(
    (d) => d.indicator !== '0' && !d.resolvableFromEvidence
  );
  const resolvableDisagreements = disagreements.filter(
    (d) => d.indicator !== '0' && d.resolvableFromEvidence
  );
  const discrepanciesPassed = unresolvableDisagreements.length === 0;
  ruleResults.push({
    ruleId: 'RULE-09',
    ruleName: 'Unresolved Discrepancies',
    mandatory: true,
    passed: discrepanciesPassed,
    status:
      unresolvableDisagreements.length > 0
        ? 'FAIL'
        : resolvableDisagreements.length > 0
          ? 'WARN'
          : 'PASS',
    details:
      unresolvableDisagreements.length > 0
        ? `${unresolvableDisagreements.length} unresolvable evidence disagreement(s) prevent deterministic reconstruction.`
        : resolvableDisagreements.length > 0
          ? `${resolvableDisagreements.length} bounded discrepancy(ies) can be resolved from authenticated execution lineage and checkpoint.`
          : 'Zero unresolved discrepancies.',
  });
  if (!discrepanciesPassed) {
    for (const d of unresolvableDisagreements) {
      reasonsForRejection.push(
        `Unresolvable ${d.disagreementType} on ${d.stateObjectId} in ${d.transactionId}: ${d.resolutionNotes}`
      );
      requiredAdditionalEvidence.push(
        `Authoritative arbitration or missing storage/execution proof for (${d.transactionId}, ${d.stateObjectId}).`
      );
    }
  } else if (resolvableDisagreements.length > 0) {
    warnings.push(
      `${resolvableDisagreements.length} discrepancy(ies) require selective state reconstruction within a certified causal boundary.`
    );
  }

  // Rule 10: Evidence Provenance
  const unavailableRpc = executionEvidence.filter(
    (e) => e.evidenceSource === 'LIVE_RPC_INFERRED'
  );
  const provenancePassed = unavailableRpc.length === 0;
  ruleResults.push({
    ruleId: 'RULE-10',
    ruleName: 'Evidence Provenance',
    mandatory: false,
    passed: provenancePassed,
    status: provenancePassed ? 'PASS' : 'WARN',
    details: provenancePassed
      ? 'All evidence records carry explicit authenticated provenance.'
      : `${unavailableRpc.length} record(s) include inferred RPC execution metadata without independent storage commit logs.`,
  });
  if (!provenancePassed) {
    warnings.push(
      'Public JSON-RPC records include inferred state transitions; independent storage-engine logs are unavailable from public endpoints.'
    );
  }

  // Calculate descriptive coverage metric (percentage of passed rules + matched correlation ratio)
  const passedRulesCount = ruleResults.filter((r) => r.passed).length;
  const ruleRatio = ruleResults.length > 0 ? passedRulesCount / ruleResults.length : 0;
  const matchedOrResolvableCount = disagreements.filter(
    (d) => d.indicator === '0' || d.resolvableFromEvidence
  ).length;
  const corrRatio =
    disagreements.length > 0 ? matchedOrResolvableCount / disagreements.length : 0;
  const descriptiveCoveragePercentage = Math.round((ruleRatio * 0.6 + corrRatio * 0.4) * 100);

  // Mandatory rules check: A high coverage percentage NEVER overrides a failed mandatory requirement
  const mandatoryRulesPassed = ruleResults
    .filter((r) => r.mandatory)
    .every((r) => r.passed);

  let status: SufficiencyStatus = 'INSUFFICIENT';
  if (mandatoryRulesPassed) {
    if (resolvableDisagreements.length === 0 && warnings.length === 0) {
      status = 'SUFFICIENT';
    } else if (config.allowConditionalRecoveryWithResolvableDisagreements) {
      status = 'CONDITIONALLY_SUFFICIENT';
    } else {
      status = 'INSUFFICIENT';
    }
  } else {
    status = 'INSUFFICIENT';
  }

  return {
    assessmentId: `COMP-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    status,
    descriptiveCoveragePercentage,
    mandatoryRulesPassed,
    ruleResults,
    missingEvidence,
    warnings,
    reasonsForRejection,
    requiredAdditionalEvidence,
    canProceedToReconstruction: status === 'SUFFICIENT' || status === 'CONDITIONALLY_SUFFICIENT',
  };
}
