import {
  CorrelationRecord,
  DisagreementIndicator,
  DisagreementRecord,
  DisagreementSeverity,
  DiscrepancySubClassification,
  ExecutionEvidence,
  StorageEvidence,
} from '../../types';

/**
 * Evaluate consistency predicate Mi = Consistent(Xi, Di) and disagreement indicator Δi in {0, 1, ⊥}
 */
export function detectDisagreements(
  correlations: CorrelationRecord[],
  executionEvidence: ExecutionEvidence[],
  storageEvidence: StorageEvidence[]
): DisagreementRecord[] {
  const execById = new Map(executionEvidence.map((e) => [e.evidenceId, e]));
  const storById = new Map(storageEvidence.map((s) => [s.evidenceId, s]));
  const records: DisagreementRecord[] = [];
  let counter = 1;

  for (const corr of correlations) {
    const exec = corr.executionEvidenceId ? execById.get(corr.executionEvidenceId) : undefined;
    const stor = corr.storageEvidenceId ? storById.get(corr.storageEvidenceId) : undefined;
    const evidenceRefs: string[] = [];
    if (corr.executionEvidenceId) evidenceRefs.push(corr.executionEvidenceId);
    if (corr.storageEvidenceId) evidenceRefs.push(corr.storageEvidenceId);

    let consistencyPredicate: boolean | null = true;
    let indicator: DisagreementIndicator = '0';
    let subClassification: DiscrepancySubClassification = 'CONSISTENT';
    let severity: DisagreementSeverity = 'NONE';
    let detectionExplanation = corr.explanation;
    let resolvableFromEvidence = true;
    let resolutionNotes = 'Execution and storage evidence are consistent.';

    switch (corr.category) {
      case 'MATCHED': {
        consistencyPredicate = true;
        indicator = '0';
        subClassification = 'CONSISTENT';
        severity = 'NONE';
        resolvableFromEvidence = true;
        break;
      }

      case 'VERSION_CONFLICT': {
        consistencyPredicate = false;
        indicator = '1';
        subClassification = 'CONFIRMED_DISAGREEMENT';
        severity = 'CRITICAL';
        // Check if execution is authenticated and storage is unverified vs both authenticated
        if (
          exec?.authenticationStatus === 'AUTHENTICATED' &&
          stor?.authenticationStatus === 'UNVERIFIED'
        ) {
          resolvableFromEvidence = true;
          resolutionNotes =
            'Storage record is unverified whereas execution evidence is cryptographically authenticated.';
        } else {
          resolvableFromEvidence = false;
          resolutionNotes =
            'Conflicting authenticated state versions between execution and storage streams cannot be resolved without authoritative arbitration.';
        }
        detectionExplanation = `Confirmed version disagreement (Δi = 1): Execution produced v${corr.expectedVersion} while storage recorded v${corr.observedStorageVersion} on ${corr.stateObjectId}.`;
        break;
      }

      case 'ORDERING_MISMATCH': {
        consistencyPredicate = false;
        indicator = '1';
        subClassification = 'CONFIRMED_DISAGREEMENT';
        severity = 'HIGH';
        const execAuth = exec?.authenticationStatus === 'AUTHENTICATED';
        // Ordering mismatch can only be resolved if execution sequence has complete authenticated version lineage
        resolvableFromEvidence = Boolean(
          execAuth && stor?.commitStatus === 'PERSISTED'
        );
        resolutionNotes = resolvableFromEvidence
          ? 'Authenticated execution sequence establishes canonical transition order over non-final storage queue ordering.'
          : 'Conflicting committed operation ordering between execution and storage requires boundary isolation.';
        detectionExplanation = `Confirmed ordering disagreement (Δi = 1): Execution sequence #${corr.executionOrdering} vs Storage ordering #${corr.storageOrdering} for ${corr.transactionId}.`;
        break;
      }

      case 'COMMIT_STATUS_CONFLICT': {
        // Distinguish between transient/incomplete persistence (e.g. PERSISTED/ACKNOWLEDGED with authenticated execution)
        // vs confirmed failure or unauthorized commit.
        if (
          exec?.executionStatus === 'SUCCESS' &&
          exec?.authenticationStatus === 'AUTHENTICATED' &&
          (corr.commitStatus === 'PERSISTED' || corr.commitStatus === 'ACKNOWLEDGED') &&
          corr.expectedVersion === corr.observedStorageVersion &&
          corr.expectedValue === corr.observedStorageValue
        ) {
          consistencyPredicate = false;
          indicator = '1';
          subClassification = 'INCOMPLETE_EVIDENCE';
          severity = 'MEDIUM';
          resolvableFromEvidence = true;
          resolutionNotes =
            'Storage write was persisted/acknowledged with matching version and value under authenticated execution; transition can be deterministically reconstructed from checkpoint and verified execution lineage.';
          detectionExplanation = `Commit finalization lag (Δi = 1, Incomplete Commit): Execution ${corr.transactionId} succeeded (v${corr.expectedVersion}), storage status is ${corr.commitStatus} with matching payload.`;
        } else {
          consistencyPredicate = false;
          indicator = '1';
          subClassification = 'CONFIRMED_DISAGREEMENT';
          severity = 'HIGH';
          resolvableFromEvidence =
            exec?.executionStatus === 'SUCCESS' &&
            exec?.authenticationStatus === 'AUTHENTICATED' &&
            corr.commitStatus === 'FAILED' &&
            corr.expectedVersion !== undefined;
          resolutionNotes = resolvableFromEvidence
            ? 'Storage write failed after authenticated execution; state can be reconstructed from checkpoint using verified execution transition.'
            : 'Unresolved commit status conflict between execution and storage.';
          detectionExplanation = `Confirmed commit status conflict (Δi = 1): Execution outcome is ${exec?.executionStatus} while storage commit status is ${corr.commitStatus}.`;
        }
        break;
      }

      case 'EXECUTION_WITHOUT_STORAGE': {
        consistencyPredicate = null;
        indicator = '⊥';
        if (exec?.evidenceSource === 'LIVE_RPC_OBSERVED' || exec?.evidenceSource === 'LIVE_RPC_INFERRED') {
          subClassification = 'UNAVAILABLE_EVIDENCE';
          severity = 'MEDIUM';
          resolvableFromEvidence = false;
          resolutionNotes =
            'Public JSON-RPC does not expose independent storage-engine commit logs; storage evidence is marked unavailable rather than corrupted.';
          detectionExplanation = `Unavailable storage evidence (Δi = ⊥): Transaction ${corr.transactionId} observed via public RPC lacks independent storage-engine log evidence.`;
        } else {
          subClassification = 'MISSING_EVIDENCE';
          severity = 'HIGH';
          resolvableFromEvidence = false;
          resolutionNotes =
            'Missing storage-operation record prevents independent confirmation of committed storage state; not classified as corruption without conflicting evidence, but suspends reconstruction unless resolved.';
          detectionExplanation = `Missing storage evidence (Δi = ⊥): Execution ${corr.transactionId} updated ${corr.stateObjectId} to v${corr.expectedVersion}, but storage evidence is absent.`;
        }
        break;
      }

      case 'STORAGE_WITHOUT_EXECUTION': {
        consistencyPredicate = null;
        indicator = '⊥';
        subClassification = 'MISSING_EVIDENCE';
        severity = 'CRITICAL';
        resolvableFromEvidence = false;
        resolutionNotes =
          'Storage operation lacks corresponding execution evidence; storage write cannot be assumed legitimate.';
        detectionExplanation = `Unverified storage operation without execution evidence (Δi = ⊥): Storage recorded v${corr.observedStorageVersion} on ${corr.stateObjectId} (${corr.transactionId}) with no execution record.`;
        break;
      }

      case 'UNRESOLVED_CORRELATION':
      default: {
        consistencyPredicate = null;
        indicator = '⊥';
        subClassification = 'INDETERMINATE_EVIDENCE';
        severity = 'HIGH';
        resolvableFromEvidence = false;
        resolutionNotes =
          'Indeterminate evidence correlation due to unknown commit status or invalid authentication metadata.';
        detectionExplanation = `Indeterminate consistency (Δi = ⊥): ${corr.explanation}`;
        break;
      }
    }

    records.push({
      disagreementId: `DIS-${String(counter++).padStart(4, '0')}`,
      correlationId: corr.correlationId,
      transactionId: corr.transactionId,
      stateObjectId: corr.stateObjectId,
      disagreementType: corr.category,
      consistencyPredicate,
      indicator,
      subClassification,
      expectedVersion: corr.expectedVersion,
      observedVersion: corr.observedStorageVersion,
      expectedOrdering: corr.executionOrdering,
      observedOrdering: corr.storageOrdering,
      evidenceReferences: evidenceRefs,
      severity,
      detectionExplanation,
      resolvableFromEvidence,
      resolutionNotes,
    });
  }

  return records;
}
