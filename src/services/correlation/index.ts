import {
  CorrelationCategory,
  CorrelationRecord,
  ExecutionEvidence,
  StorageEvidence,
} from '../../types';

export interface NormalizedExecutionUnit {
  evidenceId: string;
  transactionId: string;
  stateObjectId: string;
  executionOrdering: number;
  previousVersion: number;
  resultingVersion: number;
  newValue: string;
  executionStatus: ExecutionEvidence['executionStatus'];
  authenticationStatus: ExecutionEvidence['authenticationStatus'];
}

export function normalizeExecutionEvidence(
  records: ExecutionEvidence[]
): NormalizedExecutionUnit[] {
  const units: NormalizedExecutionUnit[] = [];
  const sorted = [...records].sort((a, b) => a.executionSequence - b.executionSequence);

  for (const rec of sorted) {
    const txId = rec.transactionId.trim();
    if (rec.stateObjectsWritten && rec.stateObjectsWritten.length > 0) {
      for (const write of rec.stateObjectsWritten) {
        units.push({
          evidenceId: rec.evidenceId,
          transactionId: txId,
          stateObjectId: write.stateId.trim(),
          executionOrdering: rec.executionSequence,
          previousVersion: write.previousVersion,
          resultingVersion: write.resultingVersion,
          newValue: write.newValue,
          executionStatus: rec.executionStatus,
          authenticationStatus: rec.authenticationStatus,
        });
      }
    }
  }
  return units;
}

export function normalizeStorageEvidence(records: StorageEvidence[]): StorageEvidence[] {
  return [...records]
    .map((r) => ({
      ...r,
      transactionId: r.transactionId.trim(),
      affectedStateObject: r.affectedStateObject.trim(),
    }))
    .sort((a, b) => a.storageOrdering - b.storageOrdering);
}

/**
 * Correlate normalized execution evidence units against storage-operation evidence records.
 */
export function correlateEvidence(
  executionRecords: ExecutionEvidence[],
  storageRecords: StorageEvidence[]
): CorrelationRecord[] {
  const execUnits = normalizeExecutionEvidence(executionRecords);
  const storageUnits = normalizeStorageEvidence(storageRecords);
  const results: CorrelationRecord[] = [];
  const matchedStorageIds = new Set<string>();
  const now = new Date().toISOString();

  // Detect relative ordering inversions across transactions present in both streams
  const execOrderByTx = new Map<string, number>();
  for (const u of execUnits) {
    if (!execOrderByTx.has(u.transactionId)) {
      execOrderByTx.set(u.transactionId, u.executionOrdering);
    }
  }
  const storageOrderByTx = new Map<string, number>();
  for (const s of storageUnits) {
    if (!storageOrderByTx.has(s.transactionId)) {
      storageOrderByTx.set(s.transactionId, s.storageOrdering);
    }
  }

  const orderingInversionTxs = new Set<string>();
  const sharedTxs = [...execOrderByTx.keys()].filter((tx) => storageOrderByTx.has(tx));
  for (let i = 0; i < sharedTxs.length; i++) {
    for (let j = i + 1; j < sharedTxs.length; j++) {
      const txA = sharedTxs[i];
      const txB = sharedTxs[j];
      const execDiff = (execOrderByTx.get(txA) ?? 0) - (execOrderByTx.get(txB) ?? 0);
      const storDiff = (storageOrderByTx.get(txA) ?? 0) - (storageOrderByTx.get(txB) ?? 0);
      if (execDiff * storDiff < 0) {
        orderingInversionTxs.add(txA);
        orderingInversionTxs.add(txB);
      }
    }
  }

  let counter = 1;

  for (const exec of execUnits) {
    const candidates = storageUnits.filter(
      (s) =>
        !matchedStorageIds.has(s.evidenceId) &&
        s.transactionId === exec.transactionId &&
        s.affectedStateObject === exec.stateObjectId
    );

    if (candidates.length === 0) {
      // Check if there is an unlinked or ambiguous storage record on the same state object
      const ambiguousOnState = storageUnits.find(
        (s) =>
          !matchedStorageIds.has(s.evidenceId) &&
          s.affectedStateObject === exec.stateObjectId &&
          (s.transactionId === 'UNKNOWN' || s.commitStatus === 'UNKNOWN')
      );

      if (ambiguousOnState) {
        matchedStorageIds.add(ambiguousOnState.evidenceId);
        results.push({
          correlationId: `CORR-${String(counter++).padStart(4, '0')}`,
          transactionId: exec.transactionId,
          stateObjectId: exec.stateObjectId,
          executionEvidenceId: exec.evidenceId,
          storageEvidenceId: ambiguousOnState.evidenceId,
          executionOrdering: exec.executionOrdering,
          storageOrdering: ambiguousOnState.storageOrdering,
          expectedVersion: exec.resultingVersion,
          observedStorageVersion: ambiguousOnState.stateVersion,
          expectedValue: exec.newValue,
          observedStorageValue: ambiguousOnState.writtenValue,
          commitStatus: ambiguousOnState.commitStatus,
          category: 'UNRESOLVED_CORRELATION',
          explanation: `Ambiguous or unknown storage operation (${ambiguousOnState.evidenceId}) on state ${exec.stateObjectId}; transaction binding or commit state is indeterminate.`,
          timestamp: now,
        });
      } else {
        results.push({
          correlationId: `CORR-${String(counter++).padStart(4, '0')}`,
          transactionId: exec.transactionId,
          stateObjectId: exec.stateObjectId,
          executionEvidenceId: exec.evidenceId,
          executionOrdering: exec.executionOrdering,
          expectedVersion: exec.resultingVersion,
          expectedValue: exec.newValue,
          category: 'EXECUTION_WITHOUT_STORAGE',
          explanation: `Execution evidence ${exec.evidenceId} records transition of ${exec.stateObjectId} (v${exec.previousVersion} → v${exec.resultingVersion}) in ${exec.transactionId}, but no corresponding storage-operation evidence exists.`,
          timestamp: now,
        });
      }
      continue;
    }

    const stor = candidates[0];
    matchedStorageIds.add(stor.evidenceId);

    let category: CorrelationCategory = 'MATCHED';
    let explanation = `Execution record ${exec.evidenceId} and storage record ${stor.evidenceId} match on transaction ${exec.transactionId}, state ${exec.stateObjectId}, version v${exec.resultingVersion}, and ordering #${exec.executionOrdering}.`;

    if (
      stor.commitStatus === 'UNKNOWN' ||
      exec.authenticationStatus === 'INVALID_SIGNATURE' ||
      stor.authenticationStatus === 'INVALID_SIGNATURE'
    ) {
      category = 'UNRESOLVED_CORRELATION';
      explanation = `Correlation between ${exec.evidenceId} and ${stor.evidenceId} cannot be resolved due to unknown commit status (${stor.commitStatus}) or failed evidence authentication.`;
    } else if (
      (exec.executionStatus === 'SUCCESS' && stor.commitStatus !== 'COMMITTED') ||
      (exec.executionStatus !== 'SUCCESS' && stor.commitStatus === 'COMMITTED')
    ) {
      category = 'COMMIT_STATUS_CONFLICT';
      explanation = `Execution status is ${exec.executionStatus} for ${exec.transactionId}, whereas storage commit status is ${stor.commitStatus} on state ${exec.stateObjectId}.`;
    } else if (
      exec.resultingVersion !== stor.stateVersion ||
      exec.previousVersion !== stor.previousVersion ||
      exec.newValue !== stor.writtenValue
    ) {
      category = 'VERSION_CONFLICT';
      explanation = `Version/value conflict on ${exec.stateObjectId} in ${exec.transactionId}: Execution recorded v${exec.previousVersion} → v${exec.resultingVersion} (val="${exec.newValue}"), but Storage recorded v${stor.previousVersion} → v${stor.stateVersion} (val="${stor.writtenValue}").`;
    } else if (
      exec.executionOrdering !== stor.storageOrdering ||
      orderingInversionTxs.has(exec.transactionId)
    ) {
      category = 'ORDERING_MISMATCH';
      explanation = `Ordering mismatch for ${exec.transactionId} on ${exec.stateObjectId}: Execution sequence is #${exec.executionOrdering}, while Storage operation ordering is #${stor.storageOrdering}.`;
    }

    results.push({
      correlationId: `CORR-${String(counter++).padStart(4, '0')}`,
      transactionId: exec.transactionId,
      stateObjectId: exec.stateObjectId,
      executionEvidenceId: exec.evidenceId,
      storageEvidenceId: stor.evidenceId,
      executionOrdering: exec.executionOrdering,
      storageOrdering: stor.storageOrdering,
      expectedVersion: exec.resultingVersion,
      observedStorageVersion: stor.stateVersion,
      expectedValue: exec.newValue,
      observedStorageValue: stor.writtenValue,
      commitStatus: stor.commitStatus,
      category,
      explanation,
      timestamp: now,
    });
  }

  // Remaining unmatched storage records -> STORAGE_WITHOUT_EXECUTION
  for (const stor of storageUnits) {
    if (!matchedStorageIds.has(stor.evidenceId)) {
      results.push({
        correlationId: `CORR-${String(counter++).padStart(4, '0')}`,
        transactionId: stor.transactionId,
        stateObjectId: stor.affectedStateObject,
        storageEvidenceId: stor.evidenceId,
        storageOrdering: stor.storageOrdering,
        observedStorageVersion: stor.stateVersion,
        observedStorageValue: stor.writtenValue,
        commitStatus: stor.commitStatus,
        category: 'STORAGE_WITHOUT_EXECUTION',
        explanation: `Storage evidence ${stor.evidenceId} contains ${stor.commitStatus} operation on ${stor.affectedStateObject} (v${stor.previousVersion} → v${stor.stateVersion}) for ${stor.transactionId} without any corresponding execution evidence.`,
        timestamp: now,
      });
    }
  }

  return results;
}
