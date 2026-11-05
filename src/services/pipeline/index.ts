import {
  CausalBoundary,
  CausalGraphResult,
  CheckpointRecord,
  CompletenessAssessment,
  CorrelationRecord,
  DisagreementRecord,
  ExecutionEvidence,
  MerkleTreeData,
  NetworkId,
  ProtocolAcceptanceReport,
  RecoveryCertificate,
  StateObjectRecord,
  StateReconstructionResult,
  StorageEvidence,
  ValidatorConsensusReport,
} from '../../types';
import { evaluateProtocolAcceptance } from '../acceptance';
import { certifyCausalBoundary } from '../boundary';
import { buildCausalGraphAndPropagate } from '../causal';
import {
  generateRecoveryCertificate,
  tamperRecoveryCertificate,
} from '../certificates';
import { assessEvidenceCompleteness } from '../completeness';
import { correlateEvidence } from '../correlation';
import { detectDisagreements } from '../disagreement';
import { reconstructSelectiveState } from '../reconstruction';
import { runIndependentValidators } from '../validators';

export interface CompleteWorkflowOutput {
  correlations: CorrelationRecord[];
  disagreements: DisagreementRecord[];
  completeness: CompletenessAssessment;
  causalGraph: CausalGraphResult;
  boundary: CausalBoundary;
  reconstruction: StateReconstructionResult;
  merkleTree: MerkleTreeData;
  certificate: RecoveryCertificate | null;
  validatorReport: ValidatorConsensusReport | null;
  acceptanceReport: ProtocolAcceptanceReport;
  stageTimingsMs: {
    correlation: number;
    disagreement: number;
    completeness: number;
    causalPropagation: number;
    boundaryCertification: number;
    reconstruction: number;
    certificateGeneration: number;
    validatorVerification: number;
    total: number;
  };
}

/**
 * Execute the complete 12-stage Evidence-Driven Causal Boundary & State Reconstruction pipeline.
 */
export async function executeCompletePatentWorkflow(params: {
  network: NetworkId;
  checkpoint: CheckpointRecord | null;
  executionEvidence: ExecutionEvidence[];
  storageEvidence: StorageEvidence[];
  referenceEndState?: StateObjectRecord[];
  tamperCertificateAfterGen?: boolean;
  validatorPolicy?: 'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3';
}): Promise<CompleteWorkflowOutput> {
  const {
    network,
    checkpoint,
    executionEvidence,
    storageEvidence,
    referenceEndState,
    tamperCertificateAfterGen = false,
    validatorPolicy = 'UNANIMOUS_3_OF_3',
  } = params;

  const t0 = performance.now();

  const tCorr0 = performance.now();
  const correlations = correlateEvidence(executionEvidence, storageEvidence);
  const tCorr1 = performance.now();

  const tDis0 = performance.now();
  const disagreements = detectDisagreements(
    correlations,
    executionEvidence,
    storageEvidence
  );
  const tDis1 = performance.now();

  const tComp0 = performance.now();
  const completeness = await assessEvidenceCompleteness(
    executionEvidence,
    storageEvidence,
    correlations,
    disagreements,
    checkpoint
  );
  const tComp1 = performance.now();

  const tCaus0 = performance.now();
  const causalGraph = buildCausalGraphAndPropagate(
    checkpoint,
    executionEvidence,
    storageEvidence,
    disagreements
  );
  const tCaus1 = performance.now();

  const tBnd0 = performance.now();
  const boundary = await certifyCausalBoundary(
    checkpoint,
    executionEvidence,
    disagreements,
    completeness,
    causalGraph
  );
  const tBnd1 = performance.now();

  const tRec0 = performance.now();
  const { result: reconstruction, merkleTree } = await reconstructSelectiveState(
    checkpoint,
    boundary,
    completeness,
    executionEvidence,
    referenceEndState
  );
  const tRec1 = performance.now();

  const tCert0 = performance.now();
  let certificate: RecoveryCertificate | null = null;
  if (checkpoint) {
    certificate = await generateRecoveryCertificate({
      network,
      checkpoint,
      executionEvidence,
      storageEvidence,
      completeness,
      disagreements,
      boundary,
      reconstruction,
      signWithDemoKey: true,
    });
    if (tamperCertificateAfterGen && certificate) {
      certificate = tamperRecoveryCertificate(certificate);
    }
  }
  const tCert1 = performance.now();

  const tVal0 = performance.now();
  let validatorReport: ValidatorConsensusReport | null = null;
  if (certificate) {
    validatorReport = await runIndependentValidators({
      certificate,
      checkpoint,
      executionEvidence,
      storageEvidence,
      policy: validatorPolicy,
    });
  }
  const tVal1 = performance.now();

  const acceptanceReport = await evaluateProtocolAcceptance({
    completeness,
    boundary,
    reconstruction,
    certificate,
    validatorReport,
  });

  const tEnd = performance.now();

  return {
    correlations,
    disagreements,
    completeness,
    causalGraph,
    boundary,
    reconstruction,
    merkleTree,
    certificate,
    validatorReport,
    acceptanceReport,
    stageTimingsMs: {
      correlation: Number((tCorr1 - tCorr0).toFixed(3)),
      disagreement: Number((tDis1 - tDis0).toFixed(3)),
      completeness: Number((tComp1 - tComp0).toFixed(3)),
      causalPropagation: Number((tCaus1 - tCaus0).toFixed(3)),
      boundaryCertification: Number((tBnd1 - tBnd0).toFixed(3)),
      reconstruction: Number((tRec1 - tRec0).toFixed(3)),
      certificateGeneration: Number((tCert1 - tCert0).toFixed(3)),
      validatorVerification: Number((tVal1 - tVal0).toFixed(3)),
      total: Number((tEnd - t0).toFixed(3)),
    },
  };
}
