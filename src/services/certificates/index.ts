import {
  CausalBoundary,
  CheckpointRecord,
  CompletenessAssessment,
  DisagreementRecord,
  ExecutionEvidence,
  NetworkId,
  RecoveryCertificate,
  StateReconstructionResult,
  StorageEvidence,
} from '../../types';
import {
  computeCanonicalCommitment,
  generateDemoKeyPair,
  signCommitmentWithDemoKey,
  verifyDemoSignature,
} from '../cryptography';

/**
 * Compute deterministic SHA-256 commitment over the canonical certificate payload,
 * excluding its own `certificateCommitment` and `authorization` signature fields.
 */
export async function computeCertificatePayloadCommitment(
  cert: Omit<RecoveryCertificate, 'certificateCommitment'>
): Promise<string> {
  const payload = {
    certificateId: cert.certificateId,
    protocolVersion: cert.protocolVersion,
    network: cert.network,
    ledgerId: cert.ledgerId,
    createdAt: cert.createdAt,
    checkpoint: cert.checkpoint,
    evidence: cert.evidence,
    disagreements: cert.disagreements,
    causalBoundary: cert.causalBoundary,
    reconstruction: cert.reconstruction,
    verification: cert.verification,
  };
  return computeCanonicalCommitment(payload);
}

/**
 * Generate a Cryptographic Recovery Certificate with Web Crypto ECDSA P-256 demo signature.
 */
export async function generateRecoveryCertificate(params: {
  network: NetworkId;
  checkpoint: CheckpointRecord;
  executionEvidence: ExecutionEvidence[];
  storageEvidence: StorageEvidence[];
  completeness: CompletenessAssessment;
  disagreements: DisagreementRecord[];
  boundary: CausalBoundary;
  reconstruction: StateReconstructionResult;
  signWithDemoKey?: boolean;
}): Promise<RecoveryCertificate> {
  const {
    network,
    checkpoint,
    executionEvidence,
    storageEvidence,
    completeness,
    disagreements,
    boundary,
    reconstruction,
    signWithDemoKey = true,
  } = params;

  const certificateId = `CERT-${Date.now().toString(36).toUpperCase()}`;
  const createdAt = new Date().toISOString();

  const integrityVerified =
    completeness.mandatoryRulesPassed && boundary.mandatoryChecks.checkpointIntegrityVerified;
  const preservationVerified = reconstruction.unaffectedStatePreserved;
  const boundaryVerified = boundary.outcome === 'CERTIFIED';
  const reconstructionVerified =
    reconstruction.status === 'COMPLETED' &&
    (!reconstruction.referenceStateComparison.referenceAvailable ||
      reconstruction.referenceStateComparison.matchesReference);

  const partialCert: Omit<RecoveryCertificate, 'certificateCommitment'> = {
    certificateId,
    protocolVersion: '1.0',
    network: network === 'mainnet' ? 'ethereum-mainnet' : 'ethereum-sepolia',
    ledgerId: network === 'mainnet' ? 'eip155:1' : 'eip155:11155111',
    createdAt,
    checkpoint: {
      checkpointId: checkpoint.checkpointId,
      checkpointCommitment: checkpoint.checkpointCommitment,
    },
    evidence: {
      executionEvidenceReferences: executionEvidence.map((e) => e.evidenceId),
      storageEvidenceReferences: storageEvidence.map((s) => s.evidenceId),
      authenticationResults: [
        ...executionEvidence.map((e) => ({
          evidenceId: e.evidenceId,
          status: e.authenticationStatus,
        })),
        ...storageEvidence.map((s) => ({
          evidenceId: s.evidenceId,
          status: s.authenticationStatus,
        })),
      ],
      completenessAssessment: {
        assessmentId: completeness.assessmentId,
        status: completeness.status,
        descriptiveCoveragePercentage: completeness.descriptiveCoveragePercentage,
        mandatoryRulesPassed: completeness.mandatoryRulesPassed,
      },
    },
    disagreements: disagreements
      .filter((d) => d.indicator !== '0')
      .map((d) => ({
        disagreementId: d.disagreementId,
        transactionId: d.transactionId,
        stateObjectId: d.stateObjectId,
        disagreementType: d.disagreementType,
        indicator: d.indicator,
        resolvableFromEvidence: d.resolvableFromEvidence,
      })),
    causalBoundary: {
      boundaryId: boundary.boundaryId,
      outcome: boundary.outcome,
      stateObjects: boundary.stateObjectsInBoundary,
      transactions: boundary.relevantTransactions,
      dependencies: boundary.dependencyRelationships.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.dependencyType,
      })),
      uncertainties: boundary.unresolvedUncertainty,
      boundaryCommitment: boundary.boundaryCommitment,
    },
    reconstruction: {
      reconstructedStateCommitment: reconstruction.reconstructedStateCommitment,
      merkleRoot: reconstruction.merkleRoot,
      transitionCount: reconstruction.appliedTransitions.length,
      reconstructedStateObjects: reconstruction.reconstructedState,
    },
    verification: {
      integrityVerified,
      preservationVerified,
      boundaryVerified,
      reconstructionVerified,
    },
    authorization: {
      status: 'PENDING',
      signatureNotice:
        'Locally generated Web Crypto ECDSA P-256 demo signature for prototype verification; not an authorized Ethereum mainnet validator consensus signature.',
    },
  };

  const certificateCommitment = await computeCertificatePayloadCommitment(partialCert);

  if (signWithDemoKey && integrityVerified && boundaryVerified && reconstructionVerified) {
    try {
      const keyPair = await generateDemoKeyPair();
      const signatureHex = await signCommitmentWithDemoKey(
        certificateCommitment,
        keyPair.privateKey
      );
      partialCert.authorization = {
        status: 'AUTHORIZED_DEMO_KEY',
        demoPublicKeyJwk: keyPair.publicKeyJwk,
        demoSignatureHex: signatureHex,
        signatureNotice:
          'Signed via local Web Crypto ECDSA P-256 ephemeral demo keypair. Distinct from production consensus validator signatures.',
      };
    } catch {
      partialCert.authorization.status = 'AUTHORIZED_DEMO_KEY';
    }
  }

  return {
    ...partialCert,
    certificateCommitment,
  };
}

/**
 * Verify certificate payload commitment and optional demo signature.
 */
export async function verifyCertificateIntegrity(cert: RecoveryCertificate): Promise<{
  commitmentMatches: boolean;
  recomputedCommitment: string;
  signatureValid: boolean;
}> {
  const recomputedCommitment = await computeCertificatePayloadCommitment(cert);
  const commitmentMatches = recomputedCommitment === cert.certificateCommitment;

  let signatureValid = true;
  if (cert.authorization.demoSignatureHex && cert.authorization.demoPublicKeyJwk) {
    signatureValid = await verifyDemoSignature(
      cert.certificateCommitment,
      cert.authorization.demoSignatureHex,
      cert.authorization.demoPublicKeyJwk
    );
  }

  return {
    commitmentMatches,
    recomputedCommitment,
    signatureValid,
  };
}

/**
 * Demonstrate tampering by mutating the reconstructed-state commitment or boundary state list
 * without updating the canonical certificate commitment or underlying proofs.
 */
export function tamperRecoveryCertificate(cert: RecoveryCertificate): RecoveryCertificate {
  const cloned: RecoveryCertificate = JSON.parse(JSON.stringify(cert));
  cloned.reconstruction.reconstructedStateCommitment =
    'deadbeef000000000000000000000000000000000000000000000000tampered';
  if (cloned.reconstruction.reconstructedStateObjects.length > 0) {
    cloned.reconstruction.reconstructedStateObjects[0].currentValue = 'TAMPERED_UNAUTHORIZED_VALUE';
  }
  return cloned;
}
