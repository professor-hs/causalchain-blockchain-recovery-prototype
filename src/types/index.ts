export type NetworkId = 'mainnet' | 'sepolia';

export type EvidenceSourceType =
  | 'LIVE_RPC_OBSERVED'
  | 'LIVE_RPC_INFERRED'
  | 'SIMULATED_CONTROLLED'
  | 'MANUAL_ENTRY'
  | 'JSON_UPLOAD'
  | 'UNAVAILABLE_FROM_PUBLIC_RPC';

export type AuthenticationStatus =
  | 'AUTHENTICATED'
  | 'UNVERIFIED'
  | 'INVALID_SIGNATURE'
  | 'INFERRED_PROVENANCE';

export type ExecutionOutcome = 'SUCCESS' | 'REVERTED' | 'FAILED';

export interface StateReadRecord {
  stateId: string;
  versionRead: number;
  valueRead?: string;
}

export interface StateWriteRecord {
  stateId: string;
  previousVersion: number;
  resultingVersion: number;
  previousValue?: string;
  newValue: string;
}

/**
 * Execution Evidence Tuple: Ei = (Ti, Oi, Ri, Wi, Vi, Si, Ai)
 */
export interface ExecutionEvidence {
  evidenceId: string;
  transactionId: string; // Ti
  blockNumber: number;
  executionSequence: number; // Oi
  contractAddress: string;
  stateObjectsRead: StateReadRecord[]; // Ri
  stateObjectsWritten: StateWriteRecord[]; // Wi
  previousStateVersion: number; // Vi (summary/primary)
  resultingStateVersion: number; // Vi (summary/primary)
  executionStatus: ExecutionOutcome; // Si
  evidenceSource: EvidenceSourceType;
  authenticationStatus: AuthenticationStatus; // Ai
  evidenceTimestamp: string;
  evidenceHash: string;
  provenanceNote?: string;
}

export type StorageCommitStatus =
  | 'REQUESTED'
  | 'ACKNOWLEDGED'
  | 'PERSISTED'
  | 'COMMITTED'
  | 'FAILED'
  | 'UNKNOWN';

/**
 * Storage-Operation Evidence Tuple: Dj = (Tj, Kj, Oj, Vj, Cj, Aj)
 */
export interface StorageEvidence {
  evidenceId: string;
  transactionId: string; // Tj
  affectedStateObject: string; // Kj
  storageOrdering: number; // Oj
  previousVersion: number;
  stateVersion: number; // Vj
  writtenValue: string;
  operationType: 'WRITE' | 'DELETE' | 'NOOP';
  commitStatus: StorageCommitStatus; // Cj
  authenticationStatus: AuthenticationStatus; // Aj
  evidenceSource: EvidenceSourceType;
  evidenceTimestamp: string;
  evidenceHash: string;
  provenanceNote?: string;
}

export type CorrelationCategory =
  | 'MATCHED'
  | 'EXECUTION_WITHOUT_STORAGE'
  | 'STORAGE_WITHOUT_EXECUTION'
  | 'ORDERING_MISMATCH'
  | 'VERSION_CONFLICT'
  | 'COMMIT_STATUS_CONFLICT'
  | 'UNRESOLVED_CORRELATION';

export interface CorrelationRecord {
  correlationId: string;
  transactionId: string;
  stateObjectId: string;
  executionEvidenceId?: string;
  storageEvidenceId?: string;
  executionOrdering?: number;
  storageOrdering?: number;
  expectedVersion?: number;
  observedStorageVersion?: number;
  expectedValue?: string;
  observedStorageValue?: string;
  commitStatus?: StorageCommitStatus;
  category: CorrelationCategory;
  explanation: string;
  timestamp: string;
}

/**
 * Disagreement Indicator: Δi in {0, 1, ⊥}
 * '0' = Consistent
 * '1' = Verified Inconsistency Detected
 * '⊥' = Indeterminate / Insufficient Evidence to Determine Consistency
 */
export type DisagreementIndicator = '0' | '1' | '⊥';

export type DiscrepancySubClassification =
  | 'CONSISTENT'
  | 'CONFIRMED_DISAGREEMENT'
  | 'MISSING_EVIDENCE'
  | 'INCOMPLETE_EVIDENCE'
  | 'UNAVAILABLE_EVIDENCE'
  | 'INDETERMINATE_EVIDENCE';

export type DisagreementSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DisagreementRecord {
  disagreementId: string;
  correlationId: string;
  transactionId: string;
  stateObjectId: string;
  disagreementType: CorrelationCategory;
  consistencyPredicate: boolean | null; // Mi = Consistent(Xi, Di)
  indicator: DisagreementIndicator; // Δi
  subClassification: DiscrepancySubClassification;
  expectedVersion?: number;
  observedVersion?: number;
  expectedOrdering?: number;
  observedOrdering?: number;
  evidenceReferences: string[];
  severity: DisagreementSeverity;
  detectionExplanation: string;
  resolvableFromEvidence: boolean;
  resolutionNotes?: string;
}

export type SufficiencyStatus = 'SUFFICIENT' | 'CONDITIONALLY_SUFFICIENT' | 'INSUFFICIENT';

export interface CompletenessRuleResult {
  ruleId: string;
  ruleName: string;
  mandatory: boolean;
  passed: boolean;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

export interface CompletenessAssessment {
  assessmentId: string;
  timestamp: string;
  status: SufficiencyStatus;
  descriptiveCoveragePercentage: number; // Descriptive metric only; never overrides mandatory rules
  mandatoryRulesPassed: boolean;
  ruleResults: CompletenessRuleResult[];
  missingEvidence: string[];
  warnings: string[];
  reasonsForRejection: string[];
  requiredAdditionalEvidence: string[];
  canProceedToReconstruction: boolean;
}

export type DependencyType =
  | 'READ_AFTER_WRITE'
  | 'WRITE_AFTER_WRITE'
  | 'STATE_VERSION_LINEAGE'
  | 'TRANSACTION_PREDECESSOR'
  | 'UNRESOLVED_DEPENDENCY';

export type CausalNodeType =
  | 'TRANSACTION'
  | 'STATE_OBJECT'
  | 'CHECKPOINT'
  | 'DISAGREEMENT'
  | 'UNCERTAIN_DEPENDENCY'
  | 'VERIFIED';

export type CausalNodeVisualState =
  | 'NORMAL'
  | 'MATCHED'
  | 'INCONSISTENT'
  | 'POTENTIALLY_AFFECTED'
  | 'UNRESOLVED'
  | 'VERIFIED_UNAFFECTED';

export interface CausalNode {
  id: string;
  label: string;
  nodeType: CausalNodeType;
  visualState: CausalNodeVisualState;
  transactionId?: string;
  stateObjectId?: string;
  stateVersion?: number;
  propagationStep: number; // 0 for initial U(0), k for U(k), -1 for unaffected
  inclusionReason: string;
  evidenceRefs: string[];
}

export interface CausalEdge {
  id: string;
  source: string;
  target: string;
  dependencyType: DependencyType;
  stateObjectId?: string;
  propagatesUncertainty: boolean;
  explanation: string;
}

export interface CausalGraphResult {
  nodes: CausalNode[];
  edges: CausalEdge[];
  directlyInconsistentNodes: string[];
  transitivelyAffectedNodes: string[];
  unresolvedDependencyNodes: string[];
  verifiedUnaffectedNodes: string[];
  propagationIterations: { step: number; addedNodes: string[] }[];
}

export type BoundaryCertificationOutcome = 'CERTIFIED' | 'PROVISIONAL' | 'REJECTED';

export interface StateObjectRecord {
  stateId: string;
  currentValue: string;
  stateVersion: number;
  lastTransaction: string;
  integrityHash: string;
}

export interface CheckpointRecord {
  checkpointId: string;
  blockNumber: number;
  timestamp: string;
  stateObjects: StateObjectRecord[];
  checkpointCommitment: string;
  authenticated: boolean;
}

/**
 * Causal Boundary Tuple: B = (SB, TB, EB, CB, UB)
 */
export interface CausalBoundary {
  boundaryId: string;
  createdAt: string;
  outcome: BoundaryCertificationOutcome;
  stateObjectsInBoundary: string[]; // SB
  unaffectedStateObjects: string[];
  relevantTransactions: string[]; // TB
  dependencyRelationships: CausalEdge[]; // EB
  authenticatedCheckpointId: string; // CB
  checkpointCommitment: string;
  unresolvedUncertainty: string[]; // UB
  boundaryCommitment: string;
  certificationExplanation: string;
  mandatoryChecks: {
    mandatoryEvidenceSatisfied: boolean;
    dependenciesResolvedOrCovered: boolean;
    suitableCheckpointAvailable: boolean;
    checkpointIntegrityVerified: boolean;
    noUnresolvedCriticalUncertainty: boolean;
    allAffectedStateIncluded: boolean;
  };
}

export interface VerifiedTransition {
  transactionId: string;
  executionSequence: number;
  stateId: string;
  previousVersion: number;
  resultingVersion: number;
  previousValue?: string;
  newValue: string;
  verifiedByEvidenceId: string;
}

export type ReconstructionStatus = 'COMPLETED' | 'SUSPENDED' | 'REJECTED';

export interface StateReconstructionResult {
  reconstructionId: string;
  boundaryId: string;
  checkpointId: string;
  status: ReconstructionStatus;
  suspensionReason?: string;
  appliedTransitions: VerifiedTransition[];
  skippedOrMissingTransitions: string[];
  beforeState: StateObjectRecord[];
  reconstructedState: StateObjectRecord[]; // SB' = Apply(SC, TBv)
  unaffectedStatePreserved: boolean;
  referenceStateComparison: {
    referenceAvailable: boolean;
    matchesReference: boolean;
    discrepancies: string[];
  };
  reconstructedStateCommitment: string;
  merkleRoot: string;
  timestamp: string;
}

export interface MerkleProofStep {
  position: 'left' | 'right';
  hash: string;
}

export interface MerkleInclusionProof {
  leafLabel: string;
  leafHash: string;
  rootHash: string;
  steps: MerkleProofStep[];
}

export interface MerkleTreeData {
  root: string;
  leaves: { label: string; valueHash: string }[];
  layers: string[][];
  proofs: Record<string, MerkleInclusionProof>;
}

export interface RecoveryCertificate {
  certificateId: string;
  protocolVersion: '1.0';
  network: string;
  ledgerId: string;
  createdAt: string;
  checkpoint: {
    checkpointId: string;
    checkpointCommitment: string;
  };
  evidence: {
    executionEvidenceReferences: string[];
    storageEvidenceReferences: string[];
    authenticationResults: { evidenceId: string; status: AuthenticationStatus }[];
    completenessAssessment: {
      assessmentId: string;
      status: SufficiencyStatus;
      descriptiveCoveragePercentage: number;
      mandatoryRulesPassed: boolean;
    };
  };
  disagreements: {
    disagreementId: string;
    transactionId: string;
    stateObjectId: string;
    disagreementType: CorrelationCategory;
    indicator: DisagreementIndicator;
    resolvableFromEvidence: boolean;
  }[];
  causalBoundary: {
    boundaryId: string;
    outcome: BoundaryCertificationOutcome;
    stateObjects: string[];
    transactions: string[];
    dependencies: { source: string; target: string; type: DependencyType }[];
    uncertainties: string[];
    boundaryCommitment: string;
  };
  reconstruction: {
    reconstructedStateCommitment: string;
    merkleRoot: string;
    transitionCount: number;
    reconstructedStateObjects: StateObjectRecord[];
  };
  verification: {
    integrityVerified: boolean;
    preservationVerified: boolean;
    boundaryVerified: boolean;
    reconstructionVerified: boolean;
  };
  authorization: {
    status: 'PENDING' | 'AUTHORIZED_DEMO_KEY' | 'REJECTED';
    demoPublicKeyJwk?: JsonWebKey;
    demoSignatureHex?: string;
    signatureNotice: string;
  };
  certificateCommitment: string;
}

export type ValidatorOutcome = 'ACCEPTED' | 'REJECTED' | 'INDETERMINATE';

export interface ValidatorCheckItem {
  checkName: string;
  passed: boolean;
  details: string;
}

export interface IndividualValidatorReport {
  validatorId: string;
  validatorName: string;
  profileDescription: string;
  outcome: ValidatorOutcome;
  checks: ValidatorCheckItem[];
  failedReasons: string[];
  verifiedAt: string;
}

export interface ValidatorConsensusReport {
  certificateId: string;
  policy: 'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3';
  overallOutcome: ValidatorOutcome;
  validatorReports: IndividualValidatorReport[];
  evaluatedAt: string;
}

export type RecoveryAcceptanceDecision = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUSPENDED';

export interface ProtocolAcceptanceReport {
  decisionId: string;
  decision: RecoveryAcceptanceDecision;
  timestamp: string;
  certificateId?: string;
  boundaryId?: string;
  conditions: {
    evidenceSufficient: boolean;
    boundaryCertified: boolean;
    reconstructionVerified: boolean;
    cryptographicCommitmentValid: boolean;
    unaffectedStatePreserved: boolean;
    validatorApprovalAchieved: boolean;
    recoveryAuthorizationSatisfied: boolean;
  };
  reasons: string[];
  auditEventId: string;
}

export type AuditEventType =
  | 'EVIDENCE_CREATED'
  | 'EVIDENCE_MODIFIED'
  | 'CORRELATION_EXECUTED'
  | 'DISAGREEMENT_DETECTED'
  | 'COMPLETENESS_ASSESSED'
  | 'CAUSAL_PROPAGATION_COMPUTED'
  | 'BOUNDARY_CERTIFIED'
  | 'RECONSTRUCTION_ATTEMPTED'
  | 'COMMITMENT_GENERATED'
  | 'CERTIFICATE_GENERATED'
  | 'CERTIFICATE_TAMPERED'
  | 'VALIDATOR_DECISION'
  | 'RECOVERY_DECISION'
  | 'SCENARIO_LOADED'
  | 'SYSTEM_RESET';

export interface AuditLogEntry {
  eventId: string;
  sequence: number;
  timestamp: string;
  eventType: AuditEventType;
  relatedTransaction?: string;
  relatedEvidence?: string;
  summary: string;
  previousAuditHash: string;
  currentAuditHash: string;
}

export type ScenarioId =
  | 'SCENARIO_A'
  | 'SCENARIO_B'
  | 'SCENARIO_C'
  | 'SCENARIO_D'
  | 'SCENARIO_E'
  | 'SCENARIO_F'
  | 'SCENARIO_G'
  | 'SCENARIO_H';

export interface ExperimentScenarioDefinition {
  id: ScenarioId;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  expectedOutcomeSummary: string;
  checkpoint: CheckpointRecord;
  executionEvidence: ExecutionEvidence[];
  storageEvidence: StorageEvidence[];
  referenceEndState: StateObjectRecord[];
  corruptCheckpointAfterCommit?: boolean;
  tamperCertificateAfterGen?: boolean;
}

export interface BenchmarkConfig {
  transactionCount: 100 | 500 | 1000 | 5000 | 10000;
  stateObjectCount: number;
  mismatchPercentage: number;
  dependencyDensity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface BenchmarkResult {
  benchmarkId: string;
  timestamp: string;
  config: BenchmarkConfig;
  timingsMs: {
    evidenceProcessingTime: number;
    disagreementDetectionTime: number;
    completenessAssessmentTime: number;
    dependencyTraversalTime: number;
    boundaryCertificationTime: number;
    reconstructionTime: number;
    hashGenerationTime: number;
    certificateVerificationTime: number;
    totalRecoveryLatency: number;
  };
  memoryUsageMb?: number;
  metrics: {
    disagreementDetectionRate: number;
    falsePositiveRate: number;
    evidenceSufficiencyAccuracy: number;
    causalBoundaryPrecision: number;
    causalBoundaryRecall: number;
    reconstructionCorrectness: number;
    statePreservationRate: number;
    certificateVerificationSuccessRate: number;
    invalidCertificateRejectionRate: number;
    recoveryLatencyMs: number;
  };
  counts: {
    injectedDisagreements: number;
    detectedDisagreements: number;
    trueAffectedNodes: number;
    identifiedBoundaryNodes: number;
    totalStateObjects: number;
    unaffectedStateObjects: number;
  };
}
