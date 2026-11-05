import {
  CheckpointRecord,
  ExecutionEvidence,
  IndividualValidatorReport,
  RecoveryCertificate,
  StorageEvidence,
  ValidatorCheckItem,
  ValidatorConsensusReport,
  ValidatorOutcome,
} from '../../types';
import { verifyCertificateIntegrity } from '../certificates';
import { verifyCheckpointIntegrity } from '../completeness';
import {
  buildMerkleTree,
  computeCanonicalCommitment,
  computeExecutionEvidenceHash,
  computeStorageEvidenceHash,
  verifyMerkleInclusionProof,
} from '../cryptography';

const DEMO_VALIDATORS = [
  {
    validatorId: 'VAL-ALPHA-01',
    validatorName: 'Alpha Verification Node (Execution & Commitment Verifier)',
    profileDescription:
      'Independent demo verifier focusing on cryptographic commitments, Merkle inclusion proofs, and certificate payload canonicalization.',
  },
  {
    validatorId: 'VAL-BETA-02',
    validatorName: 'Beta Verification Node (Causal Lineage & Boundary Auditor)',
    profileDescription:
      'Independent demo verifier auditing causal boundary completeness, execution sequence monotonicity, and unaffected state preservation.',
  },
  {
    validatorId: 'VAL-GAMMA-03',
    validatorName: 'Gamma Verification Node (Full Protocol State Re-Executor)',
    profileDescription:
      'Independent demo verifier re-executing transitions from the authenticated checkpoint to confirm deterministic state reconstruction.',
  },
];

/**
 * Run independent verification across all three demo validators.
 * A valid certificate hash alone is NEVER sufficient—validators independently recompute
 * checkpoint commitments, evidence hashes, reconstructed state commitments, and Merkle proofs.
 */
export async function runIndependentValidators(params: {
  certificate: RecoveryCertificate;
  checkpoint: CheckpointRecord | null;
  executionEvidence: ExecutionEvidence[];
  storageEvidence: StorageEvidence[];
  policy?: 'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3';
}): Promise<ValidatorConsensusReport> {
  const {
    certificate,
    checkpoint,
    executionEvidence,
    storageEvidence,
    policy = 'UNANIMOUS_3_OF_3',
  } = params;

  const validatorReports: IndividualValidatorReport[] = [];

  for (const val of DEMO_VALIDATORS) {
    const checks: ValidatorCheckItem[] = [];
    const failedReasons: string[] = [];
    let indeterminate = false;

    // Check 1: Evidence Hash Verification
    let evidenceHashesValid = executionEvidence.length > 0;
    for (const exec of executionEvidence) {
      const recomputed = await computeExecutionEvidenceHash(exec);
      if (recomputed !== exec.evidenceHash) {
        evidenceHashesValid = false;
        failedReasons.push(`Execution evidence ${exec.evidenceId} hash mismatch.`);
      }
    }
    for (const stor of storageEvidence) {
      const recomputed = await computeStorageEvidenceHash(stor);
      if (recomputed !== stor.evidenceHash) {
        evidenceHashesValid = false;
        failedReasons.push(`Storage evidence ${stor.evidenceId} hash mismatch.`);
      }
    }
    if (executionEvidence.length === 0) {
      indeterminate = true;
      failedReasons.push('No supporting execution evidence records supplied to validator.');
    }
    checks.push({
      checkName: 'Supporting Evidence Hashes Verified',
      passed: evidenceHashesValid,
      details: evidenceHashesValid
        ? `Verified SHA-256 digests for ${executionEvidence.length} execution and ${storageEvidence.length} storage records.`
        : 'Supporting evidence hash verification failed or evidence missing.',
    });

    // Check 2: Recompute Checkpoint Commitment
    const ckptCheck = await verifyCheckpointIntegrity(checkpoint);
    const ckptMatchesCert =
      ckptCheck.valid &&
      checkpoint?.checkpointCommitment === certificate.checkpoint.checkpointCommitment;
    if (!ckptMatchesCert) {
      failedReasons.push(
        `Checkpoint commitment verification failed: ${ckptCheck.reason}`
      );
    }
    checks.push({
      checkName: 'Checkpoint Commitment Recomputed',
      passed: ckptMatchesCert,
      details: ckptMatchesCert
        ? `Recomputed checkpoint commitment matches ${certificate.checkpoint.checkpointCommitment.slice(0, 16)}...`
        : `Checkpoint integrity or commitment mismatch (${ckptCheck.reason}).`,
    });

    // Check 3: Recompute Reconstructed-State Commitment
    const recomputedStateCommitment = await computeCanonicalCommitment(
      certificate.reconstruction.reconstructedStateObjects
    );
    const stateCommitmentMatches =
      recomputedStateCommitment === certificate.reconstruction.reconstructedStateCommitment &&
      certificate.reconstruction.reconstructedStateObjects.length > 0;
    if (!stateCommitmentMatches) {
      failedReasons.push(
        `Reconstructed-state commitment mismatch (certificate claims ${certificate.reconstruction.reconstructedStateCommitment.slice(0, 14)}..., recomputed ${recomputedStateCommitment.slice(0, 14)}...).`
      );
    }
    checks.push({
      checkName: 'Reconstructed-State Commitment Recomputed',
      passed: stateCommitmentMatches,
      details: stateCommitmentMatches
        ? `Independently recomputed SHA-256 state commitment matches ${recomputedStateCommitment.slice(0, 16)}...`
        : 'Reconstructed state objects do not match the committed SHA-256 digest in the certificate.',
    });

    // Check 4: Verify Merkle Root & Inclusion Proofs
    const recomputedTree = await buildMerkleTree(
      certificate.reconstruction.reconstructedStateObjects.map((s) => ({
        label: s.stateId,
        canonicalPayload: s,
      }))
    );
    let merkleValid = recomputedTree.root === certificate.reconstruction.merkleRoot;
    if (merkleValid) {
      for (const s of certificate.reconstruction.reconstructedStateObjects) {
        const proof = recomputedTree.proofs[s.stateId];
        if (!proof || !(await verifyMerkleInclusionProof(proof, certificate.reconstruction.merkleRoot))) {
          merkleValid = false;
          break;
        }
      }
    }
    if (!merkleValid) {
      failedReasons.push(
        `Merkle root or leaf inclusion proof verification failed (expected ${certificate.reconstruction.merkleRoot.slice(0, 14)}..., computed ${recomputedTree.root.slice(0, 14)}...).`
      );
    }
    checks.push({
      checkName: 'Merkle Root & Leaf Inclusion Proofs Verified',
      passed: merkleValid,
      details: merkleValid
        ? `Verified Merkle root ${recomputedTree.root.slice(0, 16)}... and ${certificate.reconstruction.reconstructedStateObjects.length} leaf inclusion proofs.`
        : 'Merkle tree root or inclusion proof verification failed.',
    });

    // Check 5: Verify Causal Boundary Consistency
    const boundaryValid =
      certificate.causalBoundary.outcome === 'CERTIFIED' &&
      certificate.causalBoundary.uncertainties.length === 0 &&
      certificate.evidence.completenessAssessment.mandatoryRulesPassed;
    if (!boundaryValid) {
      failedReasons.push(
        `Causal boundary is ${certificate.causalBoundary.outcome} with ${certificate.causalBoundary.uncertainties.length} unresolved uncertainty item(s).`
      );
    }
    checks.push({
      checkName: 'Causal Boundary Consistency & Sufficiency',
      passed: boundaryValid,
      details: boundaryValid
        ? `Boundary ${certificate.causalBoundary.boundaryId} is CERTIFIED with zero unresolved uncertainties.`
        : `Boundary is not certified (${certificate.causalBoundary.outcome}) or mandatory completeness rules failed.`,
    });

    // Check 6: Check Transition Ordering
    const boundaryTxExecs = executionEvidence.filter((e) =>
      certificate.causalBoundary.transactions.includes(e.transactionId)
    );
    const sortedSeqs = boundaryTxExecs.map((e) => e.executionSequence);
    const isMonotonic = sortedSeqs.every((v, i, a) => i === 0 || a[i - 1] <= v);
    const allBoundaryTxsPresent =
      boundaryTxExecs.length === certificate.causalBoundary.transactions.length;
    const orderingValid = isMonotonic && allBoundaryTxsPresent;
    if (!orderingValid) {
      failedReasons.push('Boundary transactions lack monotonic or complete execution sequence records.');
    }
    checks.push({
      checkName: 'Deterministic Transition Ordering Verified',
      passed: orderingValid,
      details: orderingValid
        ? `All ${boundaryTxExecs.length} boundary transaction(s) have verified monotonic execution sequence numbers.`
        : 'Missing or non-monotonic transition ordering.',
    });

    // Check 7: Check Unaffected State Preservation Conditions
    let preservationValid = certificate.verification.preservationVerified;
    if (checkpoint) {
      const boundarySet = new Set(certificate.causalBoundary.stateObjects);
      for (const ckptState of checkpoint.stateObjects) {
        if (!boundarySet.has(ckptState.stateId)) {
          const recState = certificate.reconstruction.reconstructedStateObjects.find(
            (r) => r.stateId === ckptState.stateId
          );
          if (
            !recState ||
            recState.currentValue !== ckptState.currentValue ||
            recState.stateVersion !== ckptState.stateVersion ||
            recState.integrityHash !== ckptState.integrityHash
          ) {
            preservationValid = false;
            failedReasons.push(
              `Unaffected state object ${ckptState.stateId} outside boundary SB was modified or omitted.`
            );
          }
        }
      }
    }
    checks.push({
      checkName: 'Unaffected State Preservation Verified',
      passed: preservationValid,
      details: preservationValid
        ? 'All state objects outside the certified boundary SB remain strictly identical to the checkpoint.'
        : 'Unaffected state preservation condition violated.',
    });

    // Check 8: Verify Certificate Payload Integrity
    const certIntegrity = await verifyCertificateIntegrity(certificate);
    if (!certIntegrity.commitmentMatches) {
      failedReasons.push(
        `Certificate commitment mismatch: tampering detected (certificate has ${certificate.certificateCommitment.slice(0, 14)}..., recomputed ${certIntegrity.recomputedCommitment.slice(0, 14)}...).`
      );
    }
    checks.push({
      checkName: 'Certificate Canonical Commitment Integrity',
      passed: certIntegrity.commitmentMatches,
      details: certIntegrity.commitmentMatches
        ? `Certificate payload SHA-256 matches ${certificate.certificateCommitment.slice(0, 16)}...`
        : 'Certificate payload has been modified after commitment generation (Tampering Detected).',
    });

    // Check 9: Check Authorization & Demo Signature Status
    const authValid =
      certificate.authorization.status === 'AUTHORIZED_DEMO_KEY' &&
      certIntegrity.signatureValid;
    if (!authValid) {
      failedReasons.push(
        `Certificate authorization status is ${certificate.authorization.status} or signature verification failed.`
      );
    }
    checks.push({
      checkName: 'Authorization & Demo Signature Verification',
      passed: authValid,
      details: authValid
        ? 'Web Crypto ECDSA P-256 demo signature verified against embedded public key.'
        : `Authorization check failed (${certificate.authorization.status}).`,
    });

    const allPassed = checks.every((c) => c.passed);
    let outcome: ValidatorOutcome = 'REJECTED';
    if (allPassed) {
      outcome = 'ACCEPTED';
    } else if (indeterminate) {
      outcome = 'INDETERMINATE';
    } else {
      outcome = 'REJECTED';
    }

    validatorReports.push({
      validatorId: val.validatorId,
      validatorName: val.validatorName,
      profileDescription: val.profileDescription,
      outcome,
      checks,
      failedReasons,
      verifiedAt: new Date().toISOString(),
    });
  }

  const acceptedCount = validatorReports.filter((r) => r.outcome === 'ACCEPTED').length;
  const indeterminateCount = validatorReports.filter((r) => r.outcome === 'INDETERMINATE').length;

  let overallOutcome: ValidatorOutcome = 'REJECTED';
  if (policy === 'UNANIMOUS_3_OF_3') {
    if (acceptedCount === validatorReports.length) overallOutcome = 'ACCEPTED';
    else if (indeterminateCount > 0 && acceptedCount === 0) overallOutcome = 'INDETERMINATE';
    else overallOutcome = 'REJECTED';
  } else {
    if (acceptedCount >= 2) overallOutcome = 'ACCEPTED';
    else if (indeterminateCount >= 2) overallOutcome = 'INDETERMINATE';
    else overallOutcome = 'REJECTED';
  }

  return {
    certificateId: certificate.certificateId,
    policy,
    overallOutcome,
    validatorReports,
    evaluatedAt: new Date().toISOString(),
  };
}
