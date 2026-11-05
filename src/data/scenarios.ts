import {
  CheckpointRecord,
  ExecutionEvidence,
  ExperimentScenarioDefinition,
  ScenarioId,
  StateObjectRecord,
  StorageEvidence,
} from '../types';
import {
  computeCheckpointCommitment,
  computeExecutionEvidenceHash,
  computeStateObjectHash,
  computeStorageEvidenceHash,
} from '../services/cryptography';

async function makeStateObject(
  stateId: string,
  currentValue: string,
  stateVersion: number,
  lastTransaction: string
): Promise<StateObjectRecord> {
  const base = { stateId, currentValue, stateVersion, lastTransaction };
  const integrityHash = await computeStateObjectHash(base);
  return { ...base, integrityHash };
}

async function makeCheckpoint(
  checkpointId: string,
  blockNumber: number,
  states: StateObjectRecord[]
): Promise<CheckpointRecord> {
  const base = {
    checkpointId,
    blockNumber,
    timestamp: '2025-05-10T10:00:00.000Z',
    stateObjects: states,
    authenticated: true,
  };
  const checkpointCommitment = await computeCheckpointCommitment(base);
  return { ...base, checkpointCommitment };
}

async function makeExec(
  record: Omit<ExecutionEvidence, 'evidenceHash'>
): Promise<ExecutionEvidence> {
  const evidenceHash = await computeExecutionEvidenceHash(record);
  return { ...record, evidenceHash };
}

async function makeStor(
  record: Omit<StorageEvidence, 'evidenceHash'>
): Promise<StorageEvidence> {
  const evidenceHash = await computeStorageEvidenceHash(record);
  return { ...record, evidenceHash };
}

export async function buildScenarioDataset(
  scenarioId: ScenarioId
): Promise<ExperimentScenarioDefinition> {
  const baseStates = await Promise.all([
    makeStateObject('KA', 'balance:1000', 4, 'TX-098'),
    makeStateObject('KB', 'vault:500', 2, 'TX-099'),
    makeStateObject('KC', 'pool:2500', 1, 'TX-095'),
    makeStateObject('KD', 'reserve:800', 7, 'TX-097'),
  ]);

  const checkpoint = await makeCheckpoint('CKPT-19400000', 19400000, baseStates);
  const ts = '2025-05-10T10:01:00.000Z';

  switch (scenarioId) {
    case 'SCENARIO_A': {
      // Scenario A — Normal Execution: All execution and storage records match
      const exec1 = await makeExec({
        evidenceId: 'EXEC-A-01',
        transactionId: 'TX-101',
        blockNumber: 19400001,
        executionSequence: 1,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KA', versionRead: 4, valueRead: 'balance:1000' }],
        stateObjectsWritten: [
          {
            stateId: 'KA',
            previousVersion: 4,
            resultingVersion: 5,
            previousValue: 'balance:1000',
            newValue: 'balance:900',
          },
        ],
        previousStateVersion: 4,
        resultingStateVersion: 5,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec2 = await makeExec({
        evidenceId: 'EXEC-A-02',
        transactionId: 'TX-102',
        blockNumber: 19400001,
        executionSequence: 2,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [
          { stateId: 'KA', versionRead: 5, valueRead: 'balance:900' },
          { stateId: 'KB', versionRead: 2, valueRead: 'vault:500' },
        ],
        stateObjectsWritten: [
          {
            stateId: 'KB',
            previousVersion: 2,
            resultingVersion: 3,
            previousValue: 'vault:500',
            newValue: 'vault:600',
          },
        ],
        previousStateVersion: 2,
        resultingStateVersion: 3,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const stor1 = await makeStor({
        evidenceId: 'STOR-A-01',
        transactionId: 'TX-101',
        affectedStateObject: 'KA',
        storageOrdering: 1,
        previousVersion: 4,
        stateVersion: 5,
        writtenValue: 'balance:900',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const stor2 = await makeStor({
        evidenceId: 'STOR-A-02',
        transactionId: 'TX-102',
        affectedStateObject: 'KB',
        storageOrdering: 2,
        previousVersion: 2,
        stateVersion: 3,
        writtenValue: 'vault:600',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      return {
        id: 'SCENARIO_A',
        code: 'Scenario A',
        title: 'Normal Execution (Consistent Streams)',
        subtitle: 'Complete execution and storage alignment with zero disagreements',
        description:
          'Generates consistent, authenticated execution and storage-operation evidence for TX-101 (KA v4→v5) and TX-102 (KB v2→v3). Demonstrates that when Δi = 0 across all operations, no causal boundary recovery is needed.',
        expectedOutcomeSummary:
          'All records MATCHED (Δi = 0) • Evidence SUFFICIENT • Empty Causal Boundary SB=[] • Protocol Decision: ACCEPTED (No reconstruction needed).',
        checkpoint,
        executionEvidence: [exec1, exec2],
        storageEvidence: [stor1, stor2],
        referenceEndState: baseStates,
      };
    }

    case 'SCENARIO_B': {
      // Scenario B — Missing Storage Operation:
      // T1 updates KA v4->v5 (missing storage evidence).
      // T2 reads KA@v5 and updates KB v2->v3.
      // T3 reads KB@v3 and updates KD v7->v8.
      // T4 independently updates KC v1->v2 (unaffected!).
      const exec1 = await makeExec({
        evidenceId: 'EXEC-B-01',
        transactionId: 'TX-101',
        blockNumber: 19400001,
        executionSequence: 1,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KA', versionRead: 4, valueRead: 'balance:1000' }],
        stateObjectsWritten: [
          {
            stateId: 'KA',
            previousVersion: 4,
            resultingVersion: 5,
            previousValue: 'balance:1000',
            newValue: 'balance:850',
          },
        ],
        previousStateVersion: 4,
        resultingStateVersion: 5,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec2 = await makeExec({
        evidenceId: 'EXEC-B-02',
        transactionId: 'TX-102',
        blockNumber: 19400001,
        executionSequence: 2,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [
          { stateId: 'KA', versionRead: 5, valueRead: 'balance:850' },
          { stateId: 'KB', versionRead: 2, valueRead: 'vault:500' },
        ],
        stateObjectsWritten: [
          {
            stateId: 'KB',
            previousVersion: 2,
            resultingVersion: 3,
            previousValue: 'vault:500',
            newValue: 'vault:650',
          },
        ],
        previousStateVersion: 2,
        resultingStateVersion: 3,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec3 = await makeExec({
        evidenceId: 'EXEC-B-03',
        transactionId: 'TX-103',
        blockNumber: 19400001,
        executionSequence: 3,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [
          { stateId: 'KB', versionRead: 3, valueRead: 'vault:650' },
          { stateId: 'KD', versionRead: 7, valueRead: 'reserve:800' },
        ],
        stateObjectsWritten: [
          {
            stateId: 'KD',
            previousVersion: 7,
            resultingVersion: 8,
            previousValue: 'reserve:800',
            newValue: 'reserve:950',
          },
        ],
        previousStateVersion: 7,
        resultingStateVersion: 8,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec4 = await makeExec({
        evidenceId: 'EXEC-B-04',
        transactionId: 'TX-104',
        blockNumber: 19400001,
        executionSequence: 4,
        contractAddress: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        stateObjectsRead: [{ stateId: 'KC', versionRead: 1, valueRead: 'pool:2500' }],
        stateObjectsWritten: [
          {
            stateId: 'KC',
            previousVersion: 1,
            resultingVersion: 2,
            previousValue: 'pool:2500',
            newValue: 'pool:2600',
          },
        ],
        previousStateVersion: 1,
        resultingStateVersion: 2,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      // Storage evidence omits TX-101 on KA!
      const stor2 = await makeStor({
        evidenceId: 'STOR-B-02',
        transactionId: 'TX-102',
        affectedStateObject: 'KB',
        storageOrdering: 2,
        previousVersion: 2,
        stateVersion: 3,
        writtenValue: 'vault:650',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const stor3 = await makeStor({
        evidenceId: 'STOR-B-03',
        transactionId: 'TX-103',
        affectedStateObject: 'KD',
        storageOrdering: 3,
        previousVersion: 7,
        stateVersion: 8,
        writtenValue: 'reserve:950',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const stor4 = await makeStor({
        evidenceId: 'STOR-B-04',
        transactionId: 'TX-104',
        affectedStateObject: 'KC',
        storageOrdering: 4,
        previousVersion: 1,
        stateVersion: 2,
        writtenValue: 'pool:2600',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      return {
        id: 'SCENARIO_B',
        code: 'Scenario B',
        title: 'Missing Storage Operation & Transitive Propagation',
        subtitle: 'TX-101 updates KA (v4→v5) without storage commit; TX-102 and TX-103 depend transitively',
        description:
          'Execution evidence shows TX-101 updating KA from v4 to v5, but storage evidence is missing. TX-102 reads KA@v5 and updates KB; TX-103 reads KB@v3 and updates KD. Meanwhile TX-104 updates KC independently.',
        expectedOutcomeSummary:
          'Detects EXECUTION_WITHOUT_STORAGE (Δi = ⊥) • Propagates uncertainty TX-101 → TX-102 → TX-103 (while TX-104/KC remains VERIFIED_UNAFFECTED) • Completeness INSUFFICIENT • Reconstruction SUSPENDED.',
        checkpoint,
        executionEvidence: [exec1, exec2, exec3, exec4],
        storageEvidence: [stor2, stor3, stor4],
        referenceEndState: baseStates,
      };
    }

    case 'SCENARIO_C': {
      // Scenario C — Version Conflict: Execution v4 -> v5 vs Storage v4 -> v6
      const exec1 = await makeExec({
        evidenceId: 'EXEC-C-01',
        transactionId: 'TX-101',
        blockNumber: 19400001,
        executionSequence: 1,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KA', versionRead: 4, valueRead: 'balance:1000' }],
        stateObjectsWritten: [
          {
            stateId: 'KA',
            previousVersion: 4,
            resultingVersion: 5,
            previousValue: 'balance:1000',
            newValue: 'balance:900',
          },
        ],
        previousStateVersion: 4,
        resultingStateVersion: 5,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec2 = await makeExec({
        evidenceId: 'EXEC-C-02',
        transactionId: 'TX-102',
        blockNumber: 19400001,
        executionSequence: 2,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [
          { stateId: 'KA', versionRead: 5, valueRead: 'balance:900' },
          { stateId: 'KB', versionRead: 2, valueRead: 'vault:500' },
        ],
        stateObjectsWritten: [
          {
            stateId: 'KB',
            previousVersion: 2,
            resultingVersion: 3,
            previousValue: 'vault:500',
            newValue: 'vault:600',
          },
        ],
        previousStateVersion: 2,
        resultingStateVersion: 3,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const stor1 = await makeStor({
        evidenceId: 'STOR-C-01',
        transactionId: 'TX-101',
        affectedStateObject: 'KA',
        storageOrdering: 1,
        previousVersion: 4,
        stateVersion: 6, // Version conflict: v6 instead of v5!
        writtenValue: 'balance:700',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const stor2 = await makeStor({
        evidenceId: 'STOR-C-02',
        transactionId: 'TX-102',
        affectedStateObject: 'KB',
        storageOrdering: 2,
        previousVersion: 2,
        stateVersion: 3,
        writtenValue: 'vault:600',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      return {
        id: 'SCENARIO_C',
        code: 'Scenario C',
        title: 'State Version Conflict (v4→v5 vs v4→v6)',
        subtitle: 'Execution records KA v4→v5 whereas Storage reports v4→v6',
        description:
          'Execution evidence for TX-101 transitions state object KA from v4 to v5, while authenticated storage evidence reports KA transitioning from v4 to v6. Propagates causal uncertainty to dependent transaction TX-102.',
        expectedOutcomeSummary:
          'Detects VERSION_CONFLICT (Δi = 1) • Propagates uncertainty to KA and KB • Boundary REJECTED • Unsupported reconstruction prevented.',
        checkpoint,
        executionEvidence: [exec1, exec2],
        storageEvidence: [stor1, stor2],
        referenceEndState: baseStates,
      };
    }

    case 'SCENARIO_D': {
      // Scenario D — Ordering Mismatch: Execution T1 -> T2 -> T3 vs Storage T1 -> T3 -> T2
      const exec1 = await makeExec({
        evidenceId: 'EXEC-D-01',
        transactionId: 'TX-101',
        blockNumber: 19400001,
        executionSequence: 1,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KA', versionRead: 4, valueRead: 'balance:1000' }],
        stateObjectsWritten: [
          {
            stateId: 'KA',
            previousVersion: 4,
            resultingVersion: 5,
            previousValue: 'balance:1000',
            newValue: 'balance:900',
          },
        ],
        previousStateVersion: 4,
        resultingStateVersion: 5,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec2 = await makeExec({
        evidenceId: 'EXEC-D-02',
        transactionId: 'TX-102',
        blockNumber: 19400001,
        executionSequence: 2,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [
          { stateId: 'KA', versionRead: 5, valueRead: 'balance:900' },
          { stateId: 'KB', versionRead: 2, valueRead: 'vault:500' },
        ],
        stateObjectsWritten: [
          {
            stateId: 'KB',
            previousVersion: 2,
            resultingVersion: 3,
            previousValue: 'vault:500',
            newValue: 'vault:600',
          },
        ],
        previousStateVersion: 2,
        resultingStateVersion: 3,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec3 = await makeExec({
        evidenceId: 'EXEC-D-03',
        transactionId: 'TX-103',
        blockNumber: 19400001,
        executionSequence: 3,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KB', versionRead: 3, valueRead: 'vault:600' }],
        stateObjectsWritten: [
          {
            stateId: 'KB',
            previousVersion: 3,
            resultingVersion: 4,
            previousValue: 'vault:600',
            newValue: 'vault:650',
          },
        ],
        previousStateVersion: 3,
        resultingStateVersion: 4,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const stor1 = await makeStor({
        evidenceId: 'STOR-D-01',
        transactionId: 'TX-101',
        affectedStateObject: 'KA',
        storageOrdering: 1,
        previousVersion: 4,
        stateVersion: 5,
        writtenValue: 'balance:900',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      // Inverted ordering: TX-103 has storageOrdering 2, TX-102 has storageOrdering 3!
      const stor3 = await makeStor({
        evidenceId: 'STOR-D-03',
        transactionId: 'TX-103',
        affectedStateObject: 'KB',
        storageOrdering: 2,
        previousVersion: 3,
        stateVersion: 4,
        writtenValue: 'vault:650',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const stor2 = await makeStor({
        evidenceId: 'STOR-D-02',
        transactionId: 'TX-102',
        affectedStateObject: 'KB',
        storageOrdering: 3,
        previousVersion: 2,
        stateVersion: 3,
        writtenValue: 'vault:600',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      return {
        id: 'SCENARIO_D',
        code: 'Scenario D',
        title: 'Execution vs Storage Ordering Mismatch (T1→T2→T3 vs T1→T3→T2)',
        subtitle: 'Out-of-order storage commits on state object KB',
        description:
          'Execution evidence establishes sequence TX-101 (#1) → TX-102 (#2) → TX-103 (#3), whereas storage commit logs record TX-101 (#1) → TX-103 (#2) → TX-102 (#3) on state object KB.',
        expectedOutcomeSummary:
          'Detects ORDERING_MISMATCH (Δi = 1) on TX-102 and TX-103 • Isolates KB in causal boundary while KA remains unaffected.',
        checkpoint,
        executionEvidence: [exec1, exec2, exec3],
        storageEvidence: [stor1, stor3, stor2],
        referenceEndState: baseStates,
      };
    }

    case 'SCENARIO_E': {
      // Scenario E — Missing Execution Evidence: Storage contains a committed operation without execution record
      const exec1 = await makeExec({
        evidenceId: 'EXEC-E-01',
        transactionId: 'TX-101',
        blockNumber: 19400001,
        executionSequence: 1,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KA', versionRead: 4, valueRead: 'balance:1000' }],
        stateObjectsWritten: [
          {
            stateId: 'KA',
            previousVersion: 4,
            resultingVersion: 5,
            previousValue: 'balance:1000',
            newValue: 'balance:900',
          },
        ],
        previousStateVersion: 4,
        resultingStateVersion: 5,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const stor1 = await makeStor({
        evidenceId: 'STOR-E-01',
        transactionId: 'TX-101',
        affectedStateObject: 'KA',
        storageOrdering: 1,
        previousVersion: 4,
        stateVersion: 5,
        writtenValue: 'balance:900',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const storRogue = await makeStor({
        evidenceId: 'STOR-E-ROGUE',
        transactionId: 'TX-UNVERIFIED-99',
        affectedStateObject: 'KB',
        storageOrdering: 2,
        previousVersion: 2,
        stateVersion: 9,
        writtenValue: 'vault:0_DRAINED',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'UNVERIFIED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      return {
        id: 'SCENARIO_E',
        code: 'Scenario E',
        title: 'Missing Execution Evidence (Unverified Storage Mutation)',
        subtitle: 'Storage contains committed write on KB without corresponding execution trace',
        description:
          'Storage evidence contains a committed operation STOR-E-ROGUE mutating KB (v2→v9) under TX-UNVERIFIED-99 with no corresponding execution evidence record.',
        expectedOutcomeSummary:
          'Detects STORAGE_WITHOUT_EXECUTION (Δi = ⊥) • Marks relationship unresolved • Refuses to assume storage mutation is legitimate • Rejects recovery.',
        checkpoint,
        executionEvidence: [exec1],
        storageEvidence: [stor1, storRogue],
        referenceEndState: baseStates,
      };
    }

    case 'SCENARIO_F': {
      // Scenario F — Corrupted Checkpoint: Modify a checkpoint value after its commitment has been calculated
      const corruptedCheckpoint: CheckpointRecord = JSON.parse(JSON.stringify(checkpoint));
      corruptedCheckpoint.stateObjects[0].currentValue = 'balance:9999999_TAMPERED';

      const exec1 = await makeExec({
        evidenceId: 'EXEC-F-01',
        transactionId: 'TX-101',
        blockNumber: 19400001,
        executionSequence: 1,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KA', versionRead: 4, valueRead: 'balance:1000' }],
        stateObjectsWritten: [
          {
            stateId: 'KA',
            previousVersion: 4,
            resultingVersion: 5,
            previousValue: 'balance:1000',
            newValue: 'balance:900',
          },
        ],
        previousStateVersion: 4,
        resultingStateVersion: 5,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const stor1 = await makeStor({
        evidenceId: 'STOR-F-01',
        transactionId: 'TX-101',
        affectedStateObject: 'KA',
        storageOrdering: 1,
        previousVersion: 4,
        stateVersion: 5,
        writtenValue: 'balance:900',
        operationType: 'WRITE',
        commitStatus: 'PERSISTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      return {
        id: 'SCENARIO_F',
        code: 'Scenario F',
        title: 'Corrupted Checkpoint Detection',
        subtitle: 'Checkpoint state object KA mutated after SHA-256 checkpoint commitment calculation',
        description:
          'Modifies state object KA inside CKPT-19400000 from "balance:1000" to "balance:9999999_TAMPERED" after the checkpoint commitment was generated. Verifies that checkpoint integrity verification halts boundary certification and state reconstruction.',
        expectedOutcomeSummary:
          'Detects SHA-256 hash mismatch on Checkpoint CKPT-19400000 (RULE-07 FAIL) • Boundary REJECTED • Reconstruction REJECTED.',
        checkpoint: corruptedCheckpoint,
        executionEvidence: [exec1],
        storageEvidence: [stor1],
        referenceEndState: baseStates,
        corruptCheckpointAfterCommit: true,
      };
    }

    case 'SCENARIO_G':
    case 'SCENARIO_H': {
      // Scenario H (and G prior to certificate tampering):
      // Valid checkpoint (KA@v4, KB@v2, KC@v1, KD@v7).
      // TX-101 updates KA v4->v5 (Storage is PERSISTED rather than COMMITTED -> resolvable COMMIT_STATUS_CONFLICT).
      // TX-102 reads KA@v5 and updates KB v2->v3 (Storage is COMMITTED; transitively in boundary SB=['KA','KB']).
      // KC@v1 and KD@v7 are completely unaffected and preserved outside the boundary!
      const exec1 = await makeExec({
        evidenceId: 'EXEC-H-01',
        transactionId: 'TX-101',
        blockNumber: 19400001,
        executionSequence: 1,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [{ stateId: 'KA', versionRead: 4, valueRead: 'balance:1000' }],
        stateObjectsWritten: [
          {
            stateId: 'KA',
            previousVersion: 4,
            resultingVersion: 5,
            previousValue: 'balance:1000',
            newValue: 'balance:900',
          },
        ],
        previousStateVersion: 4,
        resultingStateVersion: 5,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const exec2 = await makeExec({
        evidenceId: 'EXEC-H-02',
        transactionId: 'TX-102',
        blockNumber: 19400001,
        executionSequence: 2,
        contractAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        stateObjectsRead: [
          { stateId: 'KA', versionRead: 5, valueRead: 'balance:900' },
          { stateId: 'KB', versionRead: 2, valueRead: 'vault:500' },
        ],
        stateObjectsWritten: [
          {
            stateId: 'KB',
            previousVersion: 2,
            resultingVersion: 3,
            previousValue: 'vault:500',
            newValue: 'vault:600',
          },
        ],
        previousStateVersion: 2,
        resultingStateVersion: 3,
        executionStatus: 'SUCCESS',
        evidenceSource: 'SIMULATED_CONTROLLED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceTimestamp: ts,
      });

      const stor1 = await makeStor({
        evidenceId: 'STOR-H-01',
        transactionId: 'TX-101',
        affectedStateObject: 'KA',
        storageOrdering: 1,
        previousVersion: 4,
        stateVersion: 5,
        writtenValue: 'balance:900',
        operationType: 'WRITE',
        commitStatus: 'PERSISTED', // Controlled commit lag discrepancy resolvable from authenticated lineage
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const stor2 = await makeStor({
        evidenceId: 'STOR-H-02',
        transactionId: 'TX-102',
        affectedStateObject: 'KB',
        storageOrdering: 2,
        previousVersion: 2,
        stateVersion: 3,
        writtenValue: 'vault:600',
        operationType: 'WRITE',
        commitStatus: 'COMMITTED',
        authenticationStatus: 'AUTHENTICATED',
        evidenceSource: 'SIMULATED_CONTROLLED',
        evidenceTimestamp: ts,
      });

      const expectedReferenceState = await Promise.all([
        makeStateObject('KA', 'balance:900', 5, 'TX-101'),
        makeStateObject('KB', 'vault:600', 3, 'TX-102'),
        makeStateObject('KC', 'pool:2500', 1, 'TX-095'),
        makeStateObject('KD', 'reserve:800', 7, 'TX-097'),
      ]);

      if (scenarioId === 'SCENARIO_G') {
        return {
          id: 'SCENARIO_G',
          code: 'Scenario G',
          title: 'Recovery Certificate Post-Generation Tampering',
          subtitle: 'Alters reconstructed-state commitment after certificate generation',
          description:
            'Executes a valid bounded state reconstruction and generates a signed RecoveryCertificate, then mutates the reconstructed-state commitment and state payload inside the certificate to test independent validator rejection.',
          expectedOutcomeSummary:
            'Certificate SHA-256 commitment check FAILS • All 3 Independent Validators REJECT the altered certificate • Protocol Acceptance Controller REJECTS recovery.',
          checkpoint,
          executionEvidence: [exec1, exec2],
          storageEvidence: [stor1, stor2],
          referenceEndState: expectedReferenceState,
          tamperCertificateAfterGen: true,
        };
      }

      return {
        id: 'SCENARIO_H',
        code: 'Scenario H',
        title: 'Successful Bounded Recovery & Cryptographic Verification',
        subtitle: 'End-to-end patent workflow: Disagreement → Causal Boundary → Selective Reconstruction → Validator Consensus',
        description:
          'Demonstrates a complete, valid bounded recovery. TX-101 experiences a storage commit finalization lag on KA (v4→v5), and TX-102 depends on KA@v5 while updating KB (v2→v3). The engine isolates SB=[KA, KB], certifies the boundary, reconstructs KA@v5 and KB@v3 from CKPT-19400000 while preserving unaffected states KC@v1 and KD@v7, generates a signed RecoveryCertificate, and passes 3-of-3 independent validator verification.',
        expectedOutcomeSummary:
          'Disagreement detected (Δi = 1, Resolvable) • Completeness CONDITIONALLY SUFFICIENT • Boundary CERTIFIED (SB=[KA, KB], Preserved=[KC, KD]) • State Reconstructed & Verified • 3/3 Validators ACCEPTED • Protocol Decision: ACCEPTED.',
        checkpoint,
        executionEvidence: [exec1, exec2],
        storageEvidence: [stor1, stor2],
        referenceEndState: expectedReferenceState,
      };
    }
  }
}

export const SCENARIO_LIST: {
  id: ScenarioId;
  code: string;
  title: string;
  badge: string;
}[] = [
  { id: 'SCENARIO_A', code: 'Scenario A', title: 'Normal Execution', badge: 'Baseline' },
  { id: 'SCENARIO_B', code: 'Scenario B', title: 'Missing Storage Operation', badge: 'Suspended' },
  { id: 'SCENARIO_C', code: 'Scenario C', title: 'Version Conflict (v4→v5 vs v6)', badge: 'Rejected' },
  { id: 'SCENARIO_D', code: 'Scenario D', title: 'Ordering Mismatch (T1→T3→T2)', badge: 'Conflict' },
  { id: 'SCENARIO_E', code: 'Scenario E', title: 'Missing Execution Evidence', badge: 'Rejected' },
  { id: 'SCENARIO_F', code: 'Scenario F', title: 'Corrupted Checkpoint', badge: 'Tamper' },
  { id: 'SCENARIO_G', code: 'Scenario G', title: 'Certificate Tampering', badge: 'Tamper' },
  { id: 'SCENARIO_H', code: 'Scenario H', title: 'Successful Bounded Recovery', badge: 'Full Recovery' },
];
