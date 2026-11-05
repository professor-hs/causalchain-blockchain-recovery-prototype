import { describe, expect, it } from 'vitest';
import { buildScenarioDataset } from '../../src/data/scenarios';
import { executeCompletePatentWorkflow } from '../../src/services/pipeline';
import { runWorkloadBenchmark } from '../../src/services/benchmarks';

describe('CAUSALCHAIN End-to-End Pipeline Integration Tests (Scenarios A–H & Benchmarks)', () => {
  it('Executes Scenario A (Normal Execution) -> ACCEPTED with empty boundary', async () => {
    const sc = await buildScenarioDataset('SCENARIO_A');
    const out = await executeCompletePatentWorkflow({
      network: 'mainnet',
      checkpoint: sc.checkpoint,
      executionEvidence: sc.executionEvidence,
      storageEvidence: sc.storageEvidence,
      referenceEndState: sc.referenceEndState,
    });
    expect(out.completeness.status).toBe('SUFFICIENT');
    expect(out.boundary.outcome).toBe('CERTIFIED');
    expect(out.boundary.stateObjectsInBoundary).toHaveLength(0);
    expect(out.acceptanceReport.decision).toBe('ACCEPTED');
  });

  it('Executes Scenario B (Missing Storage Evidence) -> INSUFFICIENT & SUSPENDED', async () => {
    const sc = await buildScenarioDataset('SCENARIO_B');
    const out = await executeCompletePatentWorkflow({
      network: 'mainnet',
      checkpoint: sc.checkpoint,
      executionEvidence: sc.executionEvidence,
      storageEvidence: sc.storageEvidence,
      referenceEndState: sc.referenceEndState,
    });
    expect(out.completeness.status).toBe('INSUFFICIENT');
    expect(out.reconstruction.status).toBe('SUSPENDED');
    expect(out.acceptanceReport.decision).toBe('SUSPENDED');
  });

  it('Executes Scenario C (Version Conflict) -> REJECTED', async () => {
    const sc = await buildScenarioDataset('SCENARIO_C');
    const out = await executeCompletePatentWorkflow({
      network: 'mainnet',
      checkpoint: sc.checkpoint,
      executionEvidence: sc.executionEvidence,
      storageEvidence: sc.storageEvidence,
      referenceEndState: sc.referenceEndState,
    });
    expect(out.boundary.outcome).toBe('REJECTED');
    expect(out.acceptanceReport.decision).toBe('REJECTED');
  });

  it('Executes Scenario F (Corrupted Checkpoint) -> REJECTED', async () => {
    const sc = await buildScenarioDataset('SCENARIO_F');
    const out = await executeCompletePatentWorkflow({
      network: 'mainnet',
      checkpoint: sc.checkpoint,
      executionEvidence: sc.executionEvidence,
      storageEvidence: sc.storageEvidence,
      referenceEndState: sc.referenceEndState,
    });
    expect(out.boundary.mandatoryChecks.checkpointIntegrityVerified).toBe(false);
    expect(out.boundary.outcome).toBe('REJECTED');
    expect(out.acceptanceReport.decision).toBe('REJECTED');
  });

  it('Executes Scenario G (Tampered Recovery Certificate) -> Validators REJECT', async () => {
    const sc = await buildScenarioDataset('SCENARIO_G');
    const out = await executeCompletePatentWorkflow({
      network: 'mainnet',
      checkpoint: sc.checkpoint,
      executionEvidence: sc.executionEvidence,
      storageEvidence: sc.storageEvidence,
      referenceEndState: sc.referenceEndState,
      tamperCertificateAfterGen: true,
    });
    expect(out.validatorReport?.overallOutcome).toBe('REJECTED');
    expect(out.acceptanceReport.decision).toBe('REJECTED');
  });

  it('Executes Scenario H (Successful Bounded Recovery) -> CERTIFIED, COMPLETED, ACCEPTED', async () => {
    const sc = await buildScenarioDataset('SCENARIO_H');
    const out = await executeCompletePatentWorkflow({
      network: 'mainnet',
      checkpoint: sc.checkpoint,
      executionEvidence: sc.executionEvidence,
      storageEvidence: sc.storageEvidence,
      referenceEndState: sc.referenceEndState,
    });
    expect(out.boundary.outcome).toBe('CERTIFIED');
    expect(out.reconstruction.status).toBe('COMPLETED');
    expect(out.reconstruction.unaffectedStatePreserved).toBe(true);
    expect(out.validatorReport?.overallOutcome).toBe('ACCEPTED');
    expect(out.acceptanceReport.decision).toBe('ACCEPTED');
  });

  it('Executes Performance Benchmark across 100, 500, 1000, 5000, and 10000 transactions and records real metrics', async () => {
    const sizes: (100 | 500 | 1000 | 5000 | 10000)[] = [100, 500, 1000, 5000, 10000];
    for (const txCount of sizes) {
      const bench = await runWorkloadBenchmark({
        transactionCount: txCount,
        stateObjectCount: 24,
        mismatchPercentage: 10,
        dependencyDensity: 'MEDIUM',
      });
      console.log(
        `BENCHMARK_${txCount}: total=${bench.timingsMs.totalRecoveryLatency}ms, corr=${bench.timingsMs.evidenceProcessingTime}ms, dis=${bench.timingsMs.disagreementDetectionTime}ms, comp=${bench.timingsMs.completenessAssessmentTime}ms, bfs=${bench.timingsMs.dependencyTraversalTime}ms, bnd=${bench.timingsMs.boundaryCertificationTime}ms, rec=${bench.timingsMs.reconstructionTime}ms, hash=${bench.timingsMs.hashGenerationTime}ms, ver=${bench.timingsMs.certificateVerificationTime}ms, detect=${bench.metrics.disagreementDetectionRate}%, fp=${bench.metrics.falsePositiveRate}%, prec=${bench.metrics.causalBoundaryPrecision}%, recall=${bench.metrics.causalBoundaryRecall}%, preserve=${bench.metrics.statePreservationRate}%`
      );
      expect(bench.metrics.disagreementDetectionRate).toBe(100);
      expect(bench.metrics.falsePositiveRate).toBe(0);
      expect(bench.metrics.reconstructionCorrectness).toBe(100);
      expect(bench.metrics.statePreservationRate).toBe(100);
      expect(bench.metrics.invalidCertificateRejectionRate).toBe(100);
    }
  });
});
