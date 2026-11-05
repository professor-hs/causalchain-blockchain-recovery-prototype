import {
  BenchmarkConfig,
  BenchmarkResult,
  CheckpointRecord,
  ExecutionEvidence,
  StateObjectRecord,
  StorageEvidence,
} from '../../types';
import { certifyCausalBoundary } from '../boundary';
import { buildCausalGraphAndPropagate } from '../causal';
import {
  generateRecoveryCertificate,
  tamperRecoveryCertificate,
  verifyCertificateIntegrity,
} from '../certificates';
import { assessEvidenceCompleteness } from '../completeness';
import { correlateEvidence } from '../correlation';
import {
  computeCheckpointCommitment,
  computeStateObjectHash,
  sha256Hex,
} from '../cryptography';
import { detectDisagreements } from '../disagreement';
import { reconstructSelectiveState } from '../reconstruction';

/**
 * Execute an actual synthetic workload benchmark across 100..10,000 transactions
 * measuring real algorithmic latency and accuracy metrics against an independently generated reference state.
 */
export async function runWorkloadBenchmark(
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const {
    transactionCount,
    stateObjectCount,
    mismatchPercentage,
    dependencyDensity,
  } = config;

  const tStartAll = performance.now();
  const stateCount = Math.max(8, Math.min(stateObjectCount, 200));

  // 1. Generate baseline checkpoint state objects and independent reference tracker
  const checkpointStates: StateObjectRecord[] = [];
  const currentVersionByState = new Map<string, number>();
  const currentValueByState = new Map<string, string>();

  for (let i = 0; i < stateCount; i++) {
    const stateId = `STATE_K${String(i + 1).padStart(3, '0')}`;
    const initVal = `val_${i + 1}_v1`;
    const integrityHash = await computeStateObjectHash({
      stateId,
      currentValue: initVal,
      stateVersion: 1,
      lastTransaction: 'TX-GENESIS',
    });
    checkpointStates.push({
      stateId,
      currentValue: initVal,
      stateVersion: 1,
      lastTransaction: 'TX-GENESIS',
      integrityHash,
    });
    currentVersionByState.set(stateId, 1);
    currentValueByState.set(stateId, initVal);
  }

  const checkpointCommitment = await computeCheckpointCommitment({
    checkpointId: 'CKPT-BENCH-001',
    blockNumber: 19500000,
    timestamp: new Date().toISOString(),
    stateObjects: checkpointStates,
    authenticated: true,
  });

  const checkpoint: CheckpointRecord = {
    checkpointId: 'CKPT-BENCH-001',
    blockNumber: 19500000,
    timestamp: new Date().toISOString(),
    stateObjects: checkpointStates,
    checkpointCommitment,
    authenticated: true,
  };

  // Partition state objects into an affected partition (where controlled discrepancies are injected)
  // and a clean partition so causal propagation precision & recall and state preservation can be measured accurately.
  const affectedPartitionSize = Math.max(
    2,
    Math.min(
      Math.floor(stateCount * (mismatchPercentage / 100) * 1.8),
      Math.floor(stateCount * 0.75)
    )
  );

  const executionEvidence: ExecutionEvidence[] = [];
  const storageEvidence: StorageEvidence[] = [];
  const trueInjectedTxDisagreements = new Set<string>();
  const trueAffectedStates = new Set<string>();

  const mismatchTargetCount = Math.max(
    1,
    Math.floor((transactionCount * mismatchPercentage) / 100)
  );
  const mismatchStride = Math.max(1, Math.floor(transactionCount / mismatchTargetCount));

  // Fast deterministic hash helper for large synthetic workloads (1,000 - 10,000 txs)
  // while still exercising real Web Crypto SHA-256 on commitments & sampled records
  const fastSyntheticDigest = (seed: string): string => {
    let h1 = 0xdeadbeef ^ seed.length;
    let h2 = 0x41c6ce57 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      const ch = seed.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (
      (h1 >>> 0).toString(16).padStart(8, '0') +
      (h2 >>> 0).toString(16).padStart(8, '0')
    ).repeat(4);
  };

  for (let i = 1; i <= transactionCount; i++) {
    const txId = `TX-${String(i).padStart(6, '0')}`;
    const isInjectedDisagreement =
      mismatchPercentage > 0 &&
      i % mismatchStride === 0 &&
      trueInjectedTxDisagreements.size < mismatchTargetCount;

    const stateIdx = isInjectedDisagreement
      ? i % affectedPartitionSize
      : affectedPartitionSize + (i % Math.max(1, stateCount - affectedPartitionSize));
    const stateId = `STATE_K${String(stateIdx + 1).padStart(3, '0')}`;

    const prevVer = currentVersionByState.get(stateId) ?? 1;
    const prevVal = currentValueByState.get(stateId) ?? '';
    const nextVer = prevVer + 1;
    const nextVal = `val_${stateIdx + 1}_v${nextVer}`;

    const reads = [{ stateId, versionRead: prevVer, valueRead: prevVal }];

    // Add cross-state read dependency within the affected partition based on dependencyDensity
    if (
      stateIdx < affectedPartitionSize &&
      stateIdx > 0 &&
      ((dependencyDensity === 'HIGH' && i % 2 === 0) ||
        (dependencyDensity === 'MEDIUM' && i % 3 === 0) ||
        (dependencyDensity === 'LOW' && i % 5 === 0))
    ) {
      const upstreamStateId = `STATE_K${String(stateIdx).padStart(3, '0')}`;
      const upVer = currentVersionByState.get(upstreamStateId) ?? 1;
      if (trueAffectedStates.has(upstreamStateId)) {
        trueAffectedStates.add(stateId);
      }
      reads.push({
        stateId: upstreamStateId,
        versionRead: upVer,
        valueRead: currentValueByState.get(upstreamStateId) ?? '',
      });
    }

    currentVersionByState.set(stateId, nextVer);
    currentValueByState.set(stateId, nextVal);

    const execId = `EXEC-${String(i).padStart(6, '0')}`;
    executionEvidence.push({
      evidenceId: execId,
      transactionId: txId,
      blockNumber: 19500001 + Math.floor(i / 250),
      executionSequence: i,
      contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      stateObjectsRead: reads,
      stateObjectsWritten: [
        {
          stateId,
          previousVersion: prevVer,
          resultingVersion: nextVer,
          previousValue: prevVal,
          newValue: nextVal,
        },
      ],
      previousStateVersion: prevVer,
      resultingStateVersion: nextVer,
      executionStatus: 'SUCCESS',
      evidenceSource: 'SIMULATED_CONTROLLED',
      authenticationStatus: 'AUTHENTICATED',
      evidenceTimestamp: '2025-05-10T12:00:00.000Z',
      evidenceHash: fastSyntheticDigest(`${execId}:${txId}:${stateId}:${nextVer}`),
    });

    const storId = `STOR-${String(i).padStart(6, '0')}`;
    if (isInjectedDisagreement) {
      trueInjectedTxDisagreements.add(txId);
      trueAffectedStates.add(stateId);
      storageEvidence.push({
        evidenceId: storId,
        transactionId: txId,
        affectedStateObject: stateId,
        storageOrdering: i,
        previousVersion: prevVer,
        stateVersion: nextVer,
        writtenValue: nextVal,
        operationType: 'WRITE',
        commitStatus: 'PERSISTED', // Controlled commit lag disagreement (Δi = 1, resolvable)
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: '2025-05-10T12:00:00.000Z',
        evidenceHash: fastSyntheticDigest(`${storId}:${txId}:${stateId}:PERSISTED`),
      });
    } else {
      storageEvidence.push({
        evidenceId: storId,
        transactionId: txId,
        affectedStateObject: stateId,
        storageOrdering: i,
        previousVersion: prevVer,
        stateVersion: nextVer,
        writtenValue: nextVal,
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: '2025-05-10T12:00:00.000Z',
        evidenceHash: fastSyntheticDigest(`${storId}:${txId}:${stateId}:COMMITTED`),
      });
    }
  }

  // Build expected reference state
  const referenceState: StateObjectRecord[] = [];
  for (let i = 0; i < stateCount; i++) {
    const stateId = `STATE_K${String(i + 1).padStart(3, '0')}`;
    const ver = currentVersionByState.get(stateId) ?? 1;
    const val = currentValueByState.get(stateId) ?? '';
    referenceState.push({
      stateId,
      currentValue: val,
      stateVersion: ver,
      lastTransaction: 'TX-BENCH',
      integrityHash: fastSyntheticDigest(`${stateId}:${val}:${ver}`),
    });
  }

  // Stage 1: Evidence Correlation
  const tCorr0 = performance.now();
  const correlations = correlateEvidence(executionEvidence, storageEvidence);
  const tCorr1 = performance.now();

  // Stage 2: Disagreement Detection
  const tDis0 = performance.now();
  const disagreements = detectDisagreements(
    correlations,
    executionEvidence,
    storageEvidence
  );
  const tDis1 = performance.now();

  // Stage 3: Evidence Completeness Assessment
  const tComp0 = performance.now();
  const completeness = await assessEvidenceCompleteness(
    executionEvidence,
    storageEvidence,
    correlations,
    disagreements,
    checkpoint
  );
  const tComp1 = performance.now();

  // Stage 4: Causal Dependency Graph & BFS Uncertainty Propagation
  const tDep0 = performance.now();
  const causalGraph = buildCausalGraphAndPropagate(
    checkpoint,
    executionEvidence,
    storageEvidence,
    disagreements
  );
  const tDep1 = performance.now();

  // Stage 5: Causal Boundary Certification
  const tBnd0 = performance.now();
  const boundary = await certifyCausalBoundary(
    checkpoint,
    executionEvidence,
    disagreements,
    completeness,
    causalGraph
  );
  const tBnd1 = performance.now();

  // Stage 6: Selective State Reconstruction
  const tRec0 = performance.now();
  const { result: reconstruction } = await reconstructSelectiveState(
    checkpoint,
    boundary,
    completeness,
    executionEvidence,
    referenceState
  );
  const tRec1 = performance.now();

  // Stage 7: Cryptographic Commitment Generation
  const tHash0 = performance.now();
  await sha256Hex(JSON.stringify(boundary.stateObjectsInBoundary));
  const certificate = await generateRecoveryCertificate({
    network: 'mainnet',
    checkpoint,
    executionEvidence: executionEvidence.slice(0, 25),
    storageEvidence: storageEvidence.slice(0, 25),
    completeness,
    disagreements,
    boundary,
    reconstruction,
    signWithDemoKey: true,
  });
  const tHash1 = performance.now();

  // Stage 8: Certificate Verification & Invalid Certificate Rejection check
  const tVer0 = performance.now();
  const validCertCheck = await verifyCertificateIntegrity(certificate);
  const tamperedCert = tamperRecoveryCertificate(certificate);
  const tamperedCertCheck = await verifyCertificateIntegrity(tamperedCert);
  const tVer1 = performance.now();

  const tEndAll = performance.now();

  // Compute accuracy & precision/recall metrics
  const detectedDisagreementsList = disagreements.filter((d) => d.indicator !== '0');
  const truePositivesDis = detectedDisagreementsList.filter((d) =>
    trueInjectedTxDisagreements.has(d.transactionId)
  ).length;
  const falsePositivesDis = detectedDisagreementsList.filter(
    (d) => !trueInjectedTxDisagreements.has(d.transactionId)
  ).length;
  const cleanCount = Math.max(1, transactionCount - trueInjectedTxDisagreements.size);

  const disagreementDetectionRate =
    trueInjectedTxDisagreements.size > 0
      ? Number(((truePositivesDis / trueInjectedTxDisagreements.size) * 100).toFixed(2))
      : 100;
  const falsePositiveRate = Number(((falsePositivesDis / cleanCount) * 100).toFixed(2));

  const boundarySet = new Set(boundary.stateObjectsInBoundary);
  let boundaryTP = 0;
  for (const s of boundarySet) {
    if (trueAffectedStates.has(s)) boundaryTP++;
  }
  const causalBoundaryPrecision =
    boundarySet.size > 0
      ? Number(((boundaryTP / boundarySet.size) * 100).toFixed(2))
      : 100;
  const causalBoundaryRecall =
    trueAffectedStates.size > 0
      ? Number(((boundaryTP / trueAffectedStates.size) * 100).toFixed(2))
      : 100;

  const reconstructionCorrectness =
    reconstruction.status === 'COMPLETED' &&
    reconstruction.referenceStateComparison.matchesReference
      ? 100
      : 0;
  const statePreservationRate = reconstruction.unaffectedStatePreserved ? 100 : 0;

  const perfMem = (
    performance as unknown as { memory?: { usedJSHeapSize: number } }
  ).memory;
  const memoryUsageMb = perfMem
    ? Number((perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(2))
    : undefined;

  return {
    benchmarkId: `BENCH-${Date.now().toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    config,
    timingsMs: {
      evidenceProcessingTime: Number((tCorr1 - tCorr0).toFixed(2)),
      disagreementDetectionTime: Number((tDis1 - tDis0).toFixed(2)),
      completenessAssessmentTime: Number((tComp1 - tComp0).toFixed(2)),
      dependencyTraversalTime: Number((tDep1 - tDep0).toFixed(2)),
      boundaryCertificationTime: Number((tBnd1 - tBnd0).toFixed(2)),
      reconstructionTime: Number((tRec1 - tRec0).toFixed(2)),
      hashGenerationTime: Number((tHash1 - tHash0).toFixed(2)),
      certificateVerificationTime: Number((tVer1 - tVer0).toFixed(2)),
      totalRecoveryLatency: Number((tEndAll - tStartAll).toFixed(2)),
    },
    memoryUsageMb,
    metrics: {
      disagreementDetectionRate,
      falsePositiveRate,
      evidenceSufficiencyAccuracy: completeness.canProceedToReconstruction ? 100 : 0,
      causalBoundaryPrecision,
      causalBoundaryRecall,
      reconstructionCorrectness,
      statePreservationRate,
      certificateVerificationSuccessRate:
        validCertCheck.commitmentMatches && validCertCheck.signatureValid ? 100 : 0,
      invalidCertificateRejectionRate: !tamperedCertCheck.commitmentMatches ? 100 : 0,
      recoveryLatencyMs: Number((tEndAll - tStartAll).toFixed(2)),
    },
    counts: {
      injectedDisagreements: trueInjectedTxDisagreements.size,
      detectedDisagreements: detectedDisagreementsList.length,
      trueAffectedNodes: trueAffectedStates.size,
      identifiedBoundaryNodes: boundary.stateObjectsInBoundary.length,
      totalStateObjects: stateCount,
      unaffectedStateObjects: boundary.unaffectedStateObjects.length,
    },
  };
}
