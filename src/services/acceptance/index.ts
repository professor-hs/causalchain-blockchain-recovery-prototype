import {
  CausalBoundary,
  CompletenessAssessment,
  ProtocolAcceptanceReport,
  RecoveryAcceptanceDecision,
  RecoveryCertificate,
  StateReconstructionResult,
  ValidatorConsensusReport,
} from '../../types';
import { verifyCertificateIntegrity } from '../certificates';

/**
 * Protocol-Compliant State Acceptance Controller (Section 20)
 * Evaluates all 7 mandatory protocol conditions before accepting a proposed operational recovery.
 */
export async function evaluateProtocolAcceptance(params: {
  completeness: CompletenessAssessment;
  boundary: CausalBoundary;
  reconstruction: StateReconstructionResult | null;
  certificate: RecoveryCertificate | null;
  validatorReport: ValidatorConsensusReport | null;
}): Promise<ProtocolAcceptanceReport> {
  const { completeness, boundary, reconstruction, certificate, validatorReport } = params;
  const reasons: string[] = [];

  const evidenceSufficient =
    completeness.status === 'SUFFICIENT' ||
    completeness.status === 'CONDITIONALLY_SUFFICIENT';
  if (!evidenceSufficient) {
    reasons.push(
      `Evidence completeness is INSUFFICIENT: ${completeness.reasonsForRejection.join(' ')}`
    );
  }

  const boundaryCertified = boundary.outcome === 'CERTIFIED';
  if (!boundaryCertified) {
    reasons.push(`Causal boundary is ${boundary.outcome}: ${boundary.certificationExplanation}`);
  }

  // Special case: Scenario A (Normal execution with zero disagreements and empty boundary SB=[])
  const isNoOpCleanState =
    evidenceSufficient &&
    boundaryCertified &&
    boundary.stateObjectsInBoundary.length === 0;

  let cryptographicCommitmentValid = false;
  let certificateTampered = false;
  if (certificate) {
    const certCheck = await verifyCertificateIntegrity(certificate);
    cryptographicCommitmentValid = certCheck.commitmentMatches && certCheck.signatureValid;
    if (!certCheck.commitmentMatches) {
      certificateTampered = true;
      reasons.push(
        'Recovery certificate cryptographic commitment verification failed (Tampering detected).'
      );
    }
  } else if (isNoOpCleanState) {
    cryptographicCommitmentValid = true;
  } else {
    reasons.push('No verified cryptographic recovery certificate available.');
  }

  const reconstructionVerified = Boolean(
    reconstruction &&
      reconstruction.status === 'COMPLETED' &&
      (!reconstruction.referenceStateComparison.referenceAvailable ||
        reconstruction.referenceStateComparison.matchesReference)
  );
  if (!reconstructionVerified && !isNoOpCleanState) {
    reasons.push(
      reconstruction?.suspensionReason ||
        'Selective state reconstruction was not completed or failed reference verification.'
    );
  }

  const unaffectedStatePreserved = Boolean(
    isNoOpCleanState || (reconstruction && reconstruction.unaffectedStatePreserved)
  );
  if (!unaffectedStatePreserved) {
    reasons.push('Unaffected state preservation invariant violated.');
  }

  const validatorApprovalAchieved = Boolean(
    isNoOpCleanState ||
      (validatorReport && validatorReport.overallOutcome === 'ACCEPTED')
  );
  if (!validatorApprovalAchieved) {
    const failedValidatorReasons =
      validatorReport?.validatorReports.flatMap((v) => v.failedReasons) ?? [];
    reasons.push(
      `Independent validator consensus did not accept certificate (outcome: ${
        validatorReport?.overallOutcome ?? 'NOT_RUN'
      }). ${failedValidatorReasons[0] ?? ''}`
    );
  }

  const recoveryAuthorizationSatisfied = Boolean(
    isNoOpCleanState ||
      (certificate &&
        certificate.authorization.status === 'AUTHORIZED_DEMO_KEY' &&
        cryptographicCommitmentValid)
  );
  if (!recoveryAuthorizationSatisfied) {
    reasons.push('Recovery authorization requirements are not satisfied.');
  }

  const allConditionsMet =
    evidenceSufficient &&
    boundaryCertified &&
    (reconstructionVerified || isNoOpCleanState) &&
    cryptographicCommitmentValid &&
    unaffectedStatePreserved &&
    validatorApprovalAchieved &&
    recoveryAuthorizationSatisfied;

  const hasHardConflict =
    !boundary.mandatoryChecks.checkpointIntegrityVerified ||
    certificateTampered ||
    completeness.reasonsForRejection.some(
      (r) =>
        r.includes('VERSION_CONFLICT') ||
        r.includes('STORAGE_WITHOUT_EXECUTION') ||
        r.includes('unverified storage operation')
    );

  let decision: RecoveryAcceptanceDecision = 'REJECTED';
  if (allConditionsMet) {
    decision = 'ACCEPTED';
    if (isNoOpCleanState) {
      reasons.push(
        'All execution and storage evidence streams match; no causal boundary discrepancy detected and no state reconstruction required.'
      );
    } else {
      reasons.push(
        `Operational state recovery ACCEPTED for boundary ${boundary.boundaryId}. Reconstructed state SB' committed while preserving finalized historical records and all unaffected state objects.`
      );
    }
  } else if (
    !hasHardConflict &&
    (reconstruction?.status === 'SUSPENDED' || boundary.outcome === 'PROVISIONAL')
  ) {
    decision = 'SUSPENDED';
  } else {
    decision = 'REJECTED';
  }

  const decisionId = `DEC-${Date.now().toString(36).toUpperCase()}`;
  return {
    decisionId,
    decision,
    timestamp: new Date().toISOString(),
    certificateId: certificate?.certificateId,
    boundaryId: boundary.boundaryId,
    conditions: {
      evidenceSufficient,
      boundaryCertified,
      reconstructionVerified: reconstructionVerified || isNoOpCleanState,
      cryptographicCommitmentValid,
      unaffectedStatePreserved,
      validatorApprovalAchieved,
      recoveryAuthorizationSatisfied,
    },
    reasons,
    auditEventId: `AUD-${decisionId}`,
  };
}
