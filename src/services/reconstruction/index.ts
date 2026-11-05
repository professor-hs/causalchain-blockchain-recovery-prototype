import {
  CausalBoundary,
  CheckpointRecord,
  CompletenessAssessment,
  ExecutionEvidence,
  StateObjectRecord,
  StateReconstructionResult,
  VerifiedTransition,
} from '../../types';
import { verifyCheckpointIntegrity } from '../completeness';
import {
  buildMerkleTree,
  computeCanonicalCommitment,
  computeStateObjectHash,
} from '../cryptography';

/**
 * Selective State Reconstruction Engine: SB' = Apply(SC, TBv)
 * Only reconstructs state objects inside a CERTIFIED CausalBoundary, preserving all state outside SB.
 */
export async function reconstructSelectiveState(
  checkpoint: CheckpointRecord | null,
  boundary: CausalBoundary,
  completeness: CompletenessAssessment,
  executionEvidence: ExecutionEvidence[],
  referenceState?: StateObjectRecord[]
): Promise<{
  result: StateReconstructionResult;
  merkleTree: Awaited<ReturnType<typeof buildMerkleTree>>;
}> {
  const now = new Date().toISOString();
  const reconstructionId = `REC-${Date.now().toString(36).toUpperCase()}`;

  // 1. Validate checkpoint integrity
  const ckptCheck = await verifyCheckpointIntegrity(checkpoint);
  if (!checkpoint || !ckptCheck.valid) {
    const emptyTree = await buildMerkleTree([]);
    return {
      result: {
        reconstructionId,
        boundaryId: boundary.boundaryId,
        checkpointId: checkpoint?.checkpointId ?? 'NONE',
        status: 'REJECTED',
        suspensionReason: `Checkpoint validation failed: ${ckptCheck.reason}`,
        appliedTransitions: [],
        skippedOrMissingTransitions: boundary.relevantTransactions,
        beforeState: checkpoint?.stateObjects ?? [],
        reconstructedState: [],
        unaffectedStatePreserved: true,
        referenceStateComparison: {
          referenceAvailable: Boolean(referenceState),
          matchesReference: false,
          discrepancies: ['Reconstruction rejected due to invalid checkpoint.'],
        },
        reconstructedStateCommitment: emptyTree.root,
        merkleRoot: emptyTree.root,
        timestamp: now,
      },
      merkleTree: emptyTree,
    };
  }

  // 2. Check evidence completeness and boundary certification
  if (!completeness.canProceedToReconstruction || completeness.status === 'INSUFFICIENT') {
    const emptyTree = await buildMerkleTree([]);
    return {
      result: {
        reconstructionId,
        boundaryId: boundary.boundaryId,
        checkpointId: checkpoint.checkpointId,
        status: 'SUSPENDED',
        suspensionReason: `Reconstruction suspended: Evidence completeness is ${completeness.status}. ${completeness.reasonsForRejection.join(' ')}`,
        appliedTransitions: [],
        skippedOrMissingTransitions: boundary.relevantTransactions,
        beforeState: checkpoint.stateObjects,
        reconstructedState: checkpoint.stateObjects,
        unaffectedStatePreserved: true,
        referenceStateComparison: {
          referenceAvailable: Boolean(referenceState),
          matchesReference: false,
          discrepancies: ['Reconstruction suspended due to insufficient evidence.'],
        },
        reconstructedStateCommitment: checkpoint.checkpointCommitment,
        merkleRoot: emptyTree.root,
        timestamp: now,
      },
      merkleTree: emptyTree,
    };
  }

  if (boundary.outcome !== 'CERTIFIED') {
    const emptyTree = await buildMerkleTree([]);
    return {
      result: {
        reconstructionId,
        boundaryId: boundary.boundaryId,
        checkpointId: checkpoint.checkpointId,
        status: boundary.outcome === 'PROVISIONAL' ? 'SUSPENDED' : 'REJECTED',
        suspensionReason: `Reconstruction requires a CERTIFIED causal boundary (current boundary status: ${boundary.outcome}). ${boundary.certificationExplanation}`,
        appliedTransitions: [],
        skippedOrMissingTransitions: boundary.relevantTransactions,
        beforeState: checkpoint.stateObjects,
        reconstructedState: checkpoint.stateObjects,
        unaffectedStatePreserved: true,
        referenceStateComparison: {
          referenceAvailable: Boolean(referenceState),
          matchesReference: false,
          discrepancies: [`Boundary is ${boundary.outcome}.`],
        },
        reconstructedStateCommitment: checkpoint.checkpointCommitment,
        merkleRoot: emptyTree.root,
        timestamp: now,
      },
      merkleTree: emptyTree,
    };
  }

  // Clone checkpoint state objects as baseline SC
  const beforeState: StateObjectRecord[] = checkpoint.stateObjects.map((s) => ({ ...s }));
  const workingStateMap = new Map<string, StateObjectRecord>();
  for (const s of beforeState) {
    workingStateMap.set(s.stateId, { ...s });
  }

  const boundaryStateSet = new Set<string>(boundary.stateObjectsInBoundary);
  const relevantTxSet = new Set<string>(boundary.relevantTransactions);

  // Also ensure unaffected state objects have their verified transitions applied ONLY if we are computing full ledger state,
  // OR wait: in Selective State Reconstruction SB' = Apply(SC, TBv), what about unaffected state objects outside SB?
  // Let's check: Outside SB, state objects either had no transitions or their committed storage state is already valid and preserved!
  // Let's check: if an unaffected transaction (not in TB) updated an unaffected state object (not in SB) cleanly with matched storage,
  // how is the unaffected state represented?
  // In checkpoint SC, if SC is the baseline before the block/batch, any matched unaffected state object's current valid state is preserved,
  // while for state objects in SB, we reconstruct SB' from SC by applying TBv!
  // Wait: what if SC already holds the current state of unaffected objects, or what if unaffected transactions also ran after SC?
  // Let's handle this cleanly:
  // Any state object NOT in `boundary.stateObjectsInBoundary` (`SB`) is NEVER modified by the selective reconstruction engine (`unaffectedStatePreserved = true`).
  // Let's verify that every transaction in `TB` (`boundary.relevantTransactions`) has authenticated, verified execution evidence.
  const sortedExec = [...executionEvidence].sort(
    (a, b) => a.executionSequence - b.executionSequence
  );

  const execByTxId = new Map(sortedExec.map((e) => [e.transactionId, e]));
  const missingTransitions: string[] = [];
  for (const txId of relevantTxSet) {
    const found = execByTxId.get(txId);
    if (
      !found ||
      found.authenticationStatus !== 'AUTHENTICATED' ||
      found.executionStatus !== 'SUCCESS'
    ) {
      missingTransitions.push(txId);
    }
  }

  if (missingTransitions.length > 0) {
    const emptyTree = await buildMerkleTree([]);
    return {
      result: {
        reconstructionId,
        boundaryId: boundary.boundaryId,
        checkpointId: checkpoint.checkpointId,
        status: 'SUSPENDED',
        suspensionReason: `Missing or unauthenticated transition(s) in TB: [${missingTransitions.join(', ')}]. Transitions are never silently skipped.`,
        appliedTransitions: [],
        skippedOrMissingTransitions: missingTransitions,
        beforeState,
        reconstructedState: beforeState,
        unaffectedStatePreserved: true,
        referenceStateComparison: {
          referenceAvailable: Boolean(referenceState),
          matchesReference: false,
          discrepancies: [`Missing verified transition(s): ${missingTransitions.join(', ')}`],
        },
        reconstructedStateCommitment: checkpoint.checkpointCommitment,
        merkleRoot: emptyTree.root,
        timestamp: now,
      },
      merkleTree: emptyTree,
    };
  }

  const appliedTransitions: VerifiedTransition[] = [];

  // 3. Apply verified transitions in strict execution sequence order
  for (const exec of sortedExec) {
    if (!relevantTxSet.has(exec.transactionId)) continue;

    // Verify read dependencies against current working state
    for (const read of exec.stateObjectsRead) {
      const currentObj = workingStateMap.get(read.stateId);
      if (!currentObj || currentObj.stateVersion !== read.versionRead) {
        const emptyTree = await buildMerkleTree([]);
        return {
          result: {
            reconstructionId,
            boundaryId: boundary.boundaryId,
            checkpointId: checkpoint.checkpointId,
            status: 'SUSPENDED',
            suspensionReason: `Dependency version mismatch during transition ${exec.transactionId}: expected ${read.stateId}@v${read.versionRead}, found v${currentObj?.stateVersion ?? 'MISSING'}.`,
            appliedTransitions,
            skippedOrMissingTransitions: [exec.transactionId],
            beforeState,
            reconstructedState: beforeState,
            unaffectedStatePreserved: true,
            referenceStateComparison: {
              referenceAvailable: Boolean(referenceState),
              matchesReference: false,
              discrepancies: [`Read dependency version mismatch on ${read.stateId}.`],
            },
            reconstructedStateCommitment: checkpoint.checkpointCommitment,
            merkleRoot: emptyTree.root,
            timestamp: now,
          },
          merkleTree: emptyTree,
        };
      }
    }

    // Apply writes for state objects in SB
    for (const write of exec.stateObjectsWritten) {
      if (!boundaryStateSet.has(write.stateId)) {
        continue;
      }
      const currentObj = workingStateMap.get(write.stateId);
      if (!currentObj || currentObj.stateVersion !== write.previousVersion) {
        const emptyTree = await buildMerkleTree([]);
        return {
          result: {
            reconstructionId,
            boundaryId: boundary.boundaryId,
            checkpointId: checkpoint.checkpointId,
            status: 'SUSPENDED',
            suspensionReason: `Pre-transition version mismatch on ${write.stateId} in ${exec.transactionId}: expected v${write.previousVersion}, found v${currentObj?.stateVersion ?? 'MISSING'}.`,
            appliedTransitions,
            skippedOrMissingTransitions: [exec.transactionId],
            beforeState,
            reconstructedState: beforeState,
            unaffectedStatePreserved: true,
            referenceStateComparison: {
              referenceAvailable: Boolean(referenceState),
              matchesReference: false,
              discrepancies: [`Write version continuity broken on ${write.stateId}.`],
            },
            reconstructedStateCommitment: checkpoint.checkpointCommitment,
            merkleRoot: emptyTree.root,
            timestamp: now,
          },
          merkleTree: emptyTree,
        };
      }

      workingStateMap.set(write.stateId, {
        stateId: write.stateId,
        currentValue: write.newValue,
        stateVersion: write.resultingVersion,
        lastTransaction: exec.transactionId,
        integrityHash: currentObj.integrityHash,
      });

      appliedTransitions.push({
        transactionId: exec.transactionId,
        executionSequence: exec.executionSequence,
        stateId: write.stateId,
        previousVersion: write.previousVersion,
        resultingVersion: write.resultingVersion,
        previousValue: write.previousValue ?? currentObj.currentValue,
        newValue: write.newValue,
        verifiedByEvidenceId: exec.evidenceId,
      });
    }
  }

  // Recompute SHA-256 integrity hashes for all reconstructed state objects in SB
  for (const stateId of boundaryStateSet) {
    const obj = workingStateMap.get(stateId);
    if (obj) {
      const newHash = await computeStateObjectHash({
        stateId: obj.stateId,
        currentValue: obj.currentValue,
        stateVersion: obj.stateVersion,
        lastTransaction: obj.lastTransaction,
      });
      workingStateMap.set(stateId, {
        ...obj,
        integrityHash: newHash,
      });
    }
  }

  const reconstructedState = Array.from(workingStateMap.values()).sort((a, b) =>
    a.stateId.localeCompare(b.stateId)
  );

  // 4. Verify that all state objects outside SB (unaffectedStateObjects) remain completely identical to beforeState
  let unaffectedStatePreserved = true;
  for (const beforeObj of beforeState) {
    if (!boundaryStateSet.has(beforeObj.stateId)) {
      const afterObj = workingStateMap.get(beforeObj.stateId);
      if (
        !afterObj ||
        afterObj.currentValue !== beforeObj.currentValue ||
        afterObj.stateVersion !== beforeObj.stateVersion ||
        afterObj.integrityHash !== beforeObj.integrityHash
      ) {
        unaffectedStatePreserved = false;
        break;
      }
    }
  }

  // 5. Build Merkle tree and commitment over reconstructedState
  const merkleTree = await buildMerkleTree(
    reconstructedState.map((s) => ({
      label: s.stateId,
      canonicalPayload: s,
    }))
  );

  const reconstructedStateCommitment = await computeCanonicalCommitment(reconstructedState);

  // 6. Compare with independently calculated reference state if provided (for boundary states SB)
  const discrepancies: string[] = [];
  if (referenceState && referenceState.length > 0) {
    for (const refObj of referenceState) {
      if (boundaryStateSet.has(refObj.stateId)) {
        const recObj = workingStateMap.get(refObj.stateId);
        if (!recObj) {
          discrepancies.push(`Missing state object ${refObj.stateId} in reconstructed state.`);
        } else if (
          recObj.currentValue !== refObj.currentValue ||
          recObj.stateVersion !== refObj.stateVersion
        ) {
          discrepancies.push(
            `State ${refObj.stateId} mismatch: reconstructed (v${recObj.stateVersion}, "${recObj.currentValue}") vs reference (v${refObj.stateVersion}, "${refObj.currentValue}").`
          );
        }
      }
    }
  }

  return {
    result: {
      reconstructionId,
      boundaryId: boundary.boundaryId,
      checkpointId: checkpoint.checkpointId,
      status: 'COMPLETED',
      appliedTransitions,
      skippedOrMissingTransitions: [],
      beforeState,
      reconstructedState,
      unaffectedStatePreserved,
      referenceStateComparison: {
        referenceAvailable: Boolean(referenceState && referenceState.length > 0),
        matchesReference: discrepancies.length === 0,
        discrepancies,
      },
      reconstructedStateCommitment,
      merkleRoot: merkleTree.root,
      timestamp: now,
    },
    merkleTree,
  };
}
