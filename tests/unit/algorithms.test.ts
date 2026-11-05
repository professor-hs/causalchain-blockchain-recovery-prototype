import { describe, expect, it } from 'vitest';
import {
  buildMerkleTree,
  canonicalJson,
  computeCanonicalCommitment,
  computeCheckpointCommitment,
  computeExecutionEvidenceHash,
  computeStateObjectHash,
  computeStorageEvidenceHash,
  sha256Hex,
  verifyMerkleInclusionProof,
} from '../../src/services/cryptography';
import {
  correlateEvidence,
  normalizeExecutionEvidence,
  normalizeStorageEvidence,
} from '../../src/services/correlation';
import { detectDisagreements } from '../../src/services/disagreement';
import {
  assessEvidenceCompleteness,
  verifyCheckpointIntegrity,
} from '../../src/services/completeness';
import { buildCausalGraphAndPropagate } from '../../src/services/causal';
import { certifyCausalBoundary } from '../../src/services/boundary';
import { reconstructSelectiveState } from '../../src/services/reconstruction';
import {
  generateRecoveryCertificate,
  tamperRecoveryCertificate,
  verifyCertificateIntegrity,
} from '../../src/services/certificates';
import { runIndependentValidators } from '../../src/services/validators';
import { evaluateProtocolAcceptance } from '../../src/services/acceptance';
import { buildScenarioDataset } from '../../src/data/scenarios';
import { appendAuditLogEntry, verifyAuditChainIntegrity } from '../../src/services/audit';

describe('CAUSALCHAIN Core Algorithms — 22 Required Patent Verification Tests', () => {
  it('1. Evidence normalization sorts by sequence and trims identifiers', async () => {
    const scenario = await buildScenarioDataset('SCENARIO_A');
    const reversedExec = [...scenario.executionEvidence].reverse();
    const reversedStor = [...scenario.storageEvidence].reverse();

    const normExec = normalizeExecutionEvidence(reversedExec);
    const normStor = normalizeStorageEvidence(reversedStor);

    expect(normExec).toHaveLength(2);
    expect(normExec[0].executionOrdering).toBe(1);
    expect(normExec[1].executionOrdering).toBe(2);
    expect(normStor[0].storageOrdering).toBe(1);
    expect(normStor[1].storageOrdering).toBe(2);
  });

  it('2. Matching execution and storage evidence produces MATCHED and Δi = 0', async () => {
    const scenario = await buildScenarioDataset('SCENARIO_A');
    const correlations = correlateEvidence(
      scenario.executionEvidence,
      scenario.storageEvidence
    );
    const disagreements = detectDisagreements(
      correlations,
      scenario.executionEvidence,
      scenario.storageEvidence
    );

    expect(correlations.every((c) => c.category === 'MATCHED')).toBe(true);
    expect(disagreements.every((d) => d.indicator === '0' && d.consistencyPredicate === true)).toBe(
      true
    );
  });

  it('3. Missing storage detection identifies EXECUTION_WITHOUT_STORAGE', async () => {
    const scenario = await buildScenarioDataset('SCENARIO_B');
    const correlations = correlateEvidence(
      scenario.executionEvidence,
      scenario.storageEvidence
    );
    const missingStor = correlations.find(
      (c) => c.transactionId === 'TX-101' && c.stateObjectId === 'KA'
    );
    expect(missingStor).toBeDefined();
    expect(missingStor?.category).toBe('EXECUTION_WITHOUT_STORAGE');
  });

  it('4. Missing execution detection identifies STORAGE_WITHOUT_EXECUTION', async () => {
    const scenario = await buildScenarioDataset('SCENARIO_E');
    const correlations = correlateEvidence(
      scenario.executionEvidence,
      scenario.storageEvidence
    );
    const missingExec = correlations.find(
      (c) => c.transactionId === 'TX-UNVERIFIED-99'
    );
    expect(missingExec).toBeDefined();
    expect(missingExec?.category).toBe('STORAGE_WITHOUT_EXECUTION');
  });

  it('5. Version conflict detection identifies VERSION_CONFLICT (v4→v5 vs v4→v6)', async () => {
    const scenario = await buildScenarioDataset('SCENARIO_C');
    const correlations = correlateEvidence(
      scenario.executionEvidence,
      scenario.storageEvidence
    );
    const disagreements = detectDisagreements(
      correlations,
      scenario.executionEvidence,
      scenario.storageEvidence
    );

    const conflict = disagreements.find((d) => d.transactionId === 'TX-101');
    expect(conflict?.disagreementType).toBe('VERSION_CONFLICT');
    expect(conflict?.indicator).toBe('1');
    expect(conflict?.consistencyPredicate).toBe(false);
    expect(conflict?.expectedVersion).toBe(5);
    expect(conflict?.observedVersion).toBe(6);
  });

  it('6. Ordering mismatch detection identifies ORDERING_MISMATCH (T1→T2→T3 vs T1→T3→T2)', async () => {
    const scenario = await buildScenarioDataset('SCENARIO_D');
    const correlations = correlateEvidence(
      scenario.executionEvidence,
      scenario.storageEvidence
    );
    const mismatches = correlations.filter(
      (c) => c.category === 'ORDERING_MISMATCH'
    );
    expect(mismatches.length).toBeGreaterThanOrEqual(2);
  });

  it('7. Indeterminate evidence classification assigns Δi = ⊥ and avoids false corruption claims', async () => {
    const scenario = await buildScenarioDataset('SCENARIO_B');
    const correlations = correlateEvidence(
      scenario.executionEvidence,
      scenario.storageEvidence
    );
    const disagreements = detectDisagreements(
      correlations,
      scenario.executionEvidence,
      scenario.storageEvidence
    );
    const missingDis = disagreements.find((d) => d.transactionId === 'TX-101');
    expect(missingDis?.indicator).toBe('⊥');
    expect(missingDis?.consistencyPredicate).toBeNull();
    expect(missingDis?.subClassification).toBe('MISSING_EVIDENCE');
  });

  it('8. Evidence completeness assessment enforces mandatory rules regardless of coverage %', async () => {
    const scenarioB = await buildScenarioDataset('SCENARIO_B');
    const corrB = correlateEvidence(
      scenarioB.executionEvidence,
      scenarioB.storageEvidence
    );
    const disB = detectDisagreements(
      corrB,
      scenarioB.executionEvidence,
      scenarioB.storageEvidence
    );
    const compB = await assessEvidenceCompleteness(
      scenarioB.executionEvidence,
      scenarioB.storageEvidence,
      corrB,
      disB,
      scenarioB.checkpoint
    );
    expect(compB.status).toBe('INSUFFICIENT');
    expect(compB.mandatoryRulesPassed).toBe(false);
    expect(compB.canProceedToReconstruction).toBe(false);

    const scenarioH = await buildScenarioDataset('SCENARIO_H');
    const corrH = correlateEvidence(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const disH = detectDisagreements(
      corrH,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const compH = await assessEvidenceCompleteness(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      corrH,
      disH,
      scenarioH.checkpoint
    );
    expect(compH.mandatoryRulesPassed).toBe(true);
    expect(compH.canProceedToReconstruction).toBe(true);
  });

  it('9. BFS causal uncertainty propagation isolates affected cone and leaves independent txs unaffected', async () => {
    const scenarioB = await buildScenarioDataset('SCENARIO_B');
    const corrB = correlateEvidence(
      scenarioB.executionEvidence,
      scenarioB.storageEvidence
    );
    const disB = detectDisagreements(
      corrB,
      scenarioB.executionEvidence,
      scenarioB.storageEvidence
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioB.checkpoint,
      scenarioB.executionEvidence,
      scenarioB.storageEvidence,
      disB
    );

    // TX-101 is directly in U(0); TX-102 and TX-103 are transitively affected; TX-104 on KC is VERIFIED_UNAFFECTED
    expect(graph.directlyInconsistentNodes).toContain('TX:TX-101');
    expect(graph.transitivelyAffectedNodes).toContain('TX:TX-102');
    expect(graph.transitivelyAffectedNodes).toContain('TX:TX-103');
    expect(graph.verifiedUnaffectedNodes).toContain('TX:TX-104');
  });

  it('10. Boundary certification certifies valid bounded recovery (Scenario H)', async () => {
    const scenarioH = await buildScenarioDataset('SCENARIO_H');
    const corr = correlateEvidence(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      corr,
      dis,
      scenarioH.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      dis,
      comp,
      graph
    );

    expect(boundary.outcome).toBe('CERTIFIED');
    expect(boundary.stateObjectsInBoundary).toEqual(['KA', 'KB']);
    expect(boundary.unaffectedStateObjects).toEqual(['KC', 'KD']);
  });

  it('11. Boundary rejection rejects unresolvable version conflicts (Scenario C)', async () => {
    const scenarioC = await buildScenarioDataset('SCENARIO_C');
    const corr = correlateEvidence(
      scenarioC.executionEvidence,
      scenarioC.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioC.executionEvidence,
      scenarioC.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioC.executionEvidence,
      scenarioC.storageEvidence,
      corr,
      dis,
      scenarioC.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioC.checkpoint,
      scenarioC.executionEvidence,
      scenarioC.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioC.checkpoint,
      scenarioC.executionEvidence,
      dis,
      comp,
      graph
    );

    expect(boundary.outcome).toBe('REJECTED');
  });

  it('12. Checkpoint integrity detects post-commitment value corruption (Scenario F)', async () => {
    const scenarioF = await buildScenarioDataset('SCENARIO_F');
    const check = await verifyCheckpointIntegrity(scenarioF.checkpoint);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('failed integrity hash verification');
  });

  it('13. Deterministic state reconstruction computes SB\' = Apply(SC, TBv) accurately', async () => {
    const scenarioH = await buildScenarioDataset('SCENARIO_H');
    const corr = correlateEvidence(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      corr,
      dis,
      scenarioH.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      dis,
      comp,
      graph
    );
    const { result } = await reconstructSelectiveState(
      scenarioH.checkpoint,
      boundary,
      comp,
      scenarioH.executionEvidence,
      scenarioH.referenceEndState
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.referenceStateComparison.matchesReference).toBe(true);
    const ka = result.reconstructedState.find((s) => s.stateId === 'KA');
    const kb = result.reconstructedState.find((s) => s.stateId === 'KB');
    expect(ka?.stateVersion).toBe(5);
    expect(ka?.currentValue).toBe('balance:900');
    expect(kb?.stateVersion).toBe(3);
    expect(kb?.currentValue).toBe('vault:600');
  });

  it('14. Unaffected-state preservation keeps all state outside SB identical to checkpoint', async () => {
    const scenarioH = await buildScenarioDataset('SCENARIO_H');
    const corr = correlateEvidence(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      corr,
      dis,
      scenarioH.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      dis,
      comp,
      graph
    );
    const { result } = await reconstructSelectiveState(
      scenarioH.checkpoint,
      boundary,
      comp,
      scenarioH.executionEvidence,
      scenarioH.referenceEndState
    );

    expect(result.unaffectedStatePreserved).toBe(true);
    const kcBefore = scenarioH.checkpoint.stateObjects.find((s) => s.stateId === 'KC');
    const kcAfter = result.reconstructedState.find((s) => s.stateId === 'KC');
    expect(kcAfter).toEqual(kcBefore);
  });

  it('15. SHA-256 commitment generation is deterministic regardless of key insertion order', async () => {
    const obj1 = { b: 2, a: 1, nested: { z: 'yes', y: 'no' } };
    const obj2 = { nested: { y: 'no', z: 'yes' }, a: 1, b: 2 };
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    const hash1 = await computeCanonicalCommitment(obj1);
    const hash2 = await computeCanonicalCommitment(obj2);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('16. Merkle root and leaf inclusion proof verification pass for valid leaves', async () => {
    const tree = await buildMerkleTree([
      { label: 'KA', canonicalPayload: { v: 5 } },
      { label: 'KB', canonicalPayload: { v: 3 } },
      { label: 'KC', canonicalPayload: { v: 1 } },
      { label: 'KD', canonicalPayload: { v: 7 } },
    ]);

    expect(tree.leaves).toHaveLength(4);
    for (const leaf of tree.leaves) {
      const proof = tree.proofs[leaf.label];
      const valid = await verifyMerkleInclusionProof(proof, tree.root);
      expect(valid).toBe(true);
    }
  });

  it('17. Invalid Merkle inclusion proof is rejected', async () => {
    const tree = await buildMerkleTree([
      { label: 'KA', canonicalPayload: { v: 5 } },
      { label: 'KB', canonicalPayload: { v: 3 } },
    ]);
    const tamperedProof = {
      ...tree.proofs['KA'],
      leafHash: await sha256Hex('TAMPERED_LEAF'),
    };
    const valid = await verifyMerkleInclusionProof(tamperedProof, tree.root);
    expect(valid).toBe(false);
  });

  it('18. Recovery certificate generation creates valid commitment and demo ECDSA signature', async () => {
    const scenarioH = await buildScenarioDataset('SCENARIO_H');
    const corr = correlateEvidence(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      corr,
      dis,
      scenarioH.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      dis,
      comp,
      graph
    );
    const { result: rec } = await reconstructSelectiveState(
      scenarioH.checkpoint,
      boundary,
      comp,
      scenarioH.executionEvidence,
      scenarioH.referenceEndState
    );
    const cert = await generateRecoveryCertificate({
      network: 'mainnet',
      checkpoint: scenarioH.checkpoint,
      executionEvidence: scenarioH.executionEvidence,
      storageEvidence: scenarioH.storageEvidence,
      completeness: comp,
      disagreements: dis,
      boundary,
      reconstruction: rec,
    });

    const check = await verifyCertificateIntegrity(cert);
    expect(check.commitmentMatches).toBe(true);
    expect(check.signatureValid).toBe(true);
  });

  it('19. Certificate tampering detection catches post-generation mutations', async () => {
    const scenarioH = await buildScenarioDataset('SCENARIO_H');
    const corr = correlateEvidence(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      corr,
      dis,
      scenarioH.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      dis,
      comp,
      graph
    );
    const { result: rec } = await reconstructSelectiveState(
      scenarioH.checkpoint,
      boundary,
      comp,
      scenarioH.executionEvidence,
      scenarioH.referenceEndState
    );
    const cert = await generateRecoveryCertificate({
      network: 'mainnet',
      checkpoint: scenarioH.checkpoint,
      executionEvidence: scenarioH.executionEvidence,
      storageEvidence: scenarioH.storageEvidence,
      completeness: comp,
      disagreements: dis,
      boundary,
      reconstruction: rec,
    });

    const tampered = tamperRecoveryCertificate(cert);
    const check = await verifyCertificateIntegrity(tampered);
    expect(check.commitmentMatches).toBe(false);
  });

  it('20. Independent validator verification accepts valid certificates and rejects tampered ones', async () => {
    const scenarioH = await buildScenarioDataset('SCENARIO_H');
    const corr = correlateEvidence(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      corr,
      dis,
      scenarioH.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      scenarioH.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioH.checkpoint,
      scenarioH.executionEvidence,
      dis,
      comp,
      graph
    );
    const { result: rec } = await reconstructSelectiveState(
      scenarioH.checkpoint,
      boundary,
      comp,
      scenarioH.executionEvidence,
      scenarioH.referenceEndState
    );
    const cert = await generateRecoveryCertificate({
      network: 'mainnet',
      checkpoint: scenarioH.checkpoint,
      executionEvidence: scenarioH.executionEvidence,
      storageEvidence: scenarioH.storageEvidence,
      completeness: comp,
      disagreements: dis,
      boundary,
      reconstruction: rec,
    });

    const validReport = await runIndependentValidators({
      certificate: cert,
      checkpoint: scenarioH.checkpoint,
      executionEvidence: scenarioH.executionEvidence,
      storageEvidence: scenarioH.storageEvidence,
    });
    expect(validReport.overallOutcome).toBe('ACCEPTED');
    expect(validReport.validatorReports).toHaveLength(3);
    expect(validReport.validatorReports.every((v) => v.outcome === 'ACCEPTED')).toBe(
      true
    );

    const tamperedReport = await runIndependentValidators({
      certificate: tamperRecoveryCertificate(cert),
      checkpoint: scenarioH.checkpoint,
      executionEvidence: scenarioH.executionEvidence,
      storageEvidence: scenarioH.storageEvidence,
    });
    expect(tamperedReport.overallOutcome).toBe('REJECTED');
  });

  it('21. Invalid recovery rejection blocks acceptance when validator or commitment fails', async () => {
    const scenarioG = await buildScenarioDataset('SCENARIO_G');
    const corr = correlateEvidence(
      scenarioG.executionEvidence,
      scenarioG.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioG.executionEvidence,
      scenarioG.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioG.executionEvidence,
      scenarioG.storageEvidence,
      corr,
      dis,
      scenarioG.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioG.checkpoint,
      scenarioG.executionEvidence,
      scenarioG.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioG.checkpoint,
      scenarioG.executionEvidence,
      dis,
      comp,
      graph
    );
    const { result: rec } = await reconstructSelectiveState(
      scenarioG.checkpoint,
      boundary,
      comp,
      scenarioG.executionEvidence,
      scenarioG.referenceEndState
    );
    const cert = tamperRecoveryCertificate(
      await generateRecoveryCertificate({
        network: 'mainnet',
        checkpoint: scenarioG.checkpoint,
        executionEvidence: scenarioG.executionEvidence,
        storageEvidence: scenarioG.storageEvidence,
        completeness: comp,
        disagreements: dis,
        boundary,
        reconstruction: rec,
      })
    );
    const valReport = await runIndependentValidators({
      certificate: cert,
      checkpoint: scenarioG.checkpoint,
      executionEvidence: scenarioG.executionEvidence,
      storageEvidence: scenarioG.storageEvidence,
    });
    const decision = await evaluateProtocolAcceptance({
      completeness: comp,
      boundary,
      reconstruction: rec,
      certificate: cert,
      validatorReport: valReport,
    });
    expect(decision.decision).toBe('REJECTED');
  });

  it('22. Insufficient evidence suspension suspends reconstruction and protocol acceptance', async () => {
    const scenarioB = await buildScenarioDataset('SCENARIO_B');
    const corr = correlateEvidence(
      scenarioB.executionEvidence,
      scenarioB.storageEvidence
    );
    const dis = detectDisagreements(
      corr,
      scenarioB.executionEvidence,
      scenarioB.storageEvidence
    );
    const comp = await assessEvidenceCompleteness(
      scenarioB.executionEvidence,
      scenarioB.storageEvidence,
      corr,
      dis,
      scenarioB.checkpoint
    );
    const graph = buildCausalGraphAndPropagate(
      scenarioB.checkpoint,
      scenarioB.executionEvidence,
      scenarioB.storageEvidence,
      dis
    );
    const boundary = await certifyCausalBoundary(
      scenarioB.checkpoint,
      scenarioB.executionEvidence,
      dis,
      comp,
      graph
    );
    const { result: rec } = await reconstructSelectiveState(
      scenarioB.checkpoint,
      boundary,
      comp,
      scenarioB.executionEvidence,
      scenarioB.referenceEndState
    );
    expect(rec.status).toBe('SUSPENDED');

    const decision = await evaluateProtocolAcceptance({
      completeness: comp,
      boundary,
      reconstruction: rec,
      certificate: null,
      validatorReport: null,
    });
    expect(decision.decision).toBe('SUSPENDED');
  });

  it('23. Hash-linked audit chain verifies valid chain and detects tampered entry', async () => {
    const e1 = await appendAuditLogEntry([], {
      eventType: 'EVIDENCE_CREATED',
      summary: 'Created EXEC-01',
    });
    const e2 = await appendAuditLogEntry([e1], {
      eventType: 'BOUNDARY_CERTIFIED',
      summary: 'Certified BND-01',
    });
    const validCheck = await verifyAuditChainIntegrity([e1, e2]);
    expect(validCheck.valid).toBe(true);

    const tamperedE1 = { ...e1, summary: 'TAMPERED_SUMMARY' };
    const invalidCheck = await verifyAuditChainIntegrity([tamperedE1, e2]);
    expect(invalidCheck.valid).toBe(false);
  });
});
