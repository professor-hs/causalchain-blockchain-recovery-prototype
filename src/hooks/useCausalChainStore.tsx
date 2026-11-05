import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  AuditEventType,
  AuditLogEntry,
  BenchmarkConfig,
  BenchmarkResult,
  CheckpointRecord,
  ExecutionEvidence,
  NetworkId,
  RecoveryCertificate,
  ScenarioId,
  StateObjectRecord,
  StorageEvidence,
} from '../types';
import { buildScenarioDataset } from '../data/scenarios';
import {
  CompleteWorkflowOutput,
  executeCompletePatentWorkflow,
} from '../services/pipeline';
import { appendAuditLogEntry } from '../services/audit';
import {
  PUBLIC_RPC_ENDPOINTS,
  fetchNetworkStatus,
} from '../services/blockchain';
import { runWorkloadBenchmark } from '../services/benchmarks';
import {
  computeExecutionEvidenceHash,
  computeStorageEvidenceHash,
} from '../services/cryptography';
import { tamperRecoveryCertificate } from '../services/certificates';
import { runIndependentValidators } from '../services/validators';
import { evaluateProtocolAcceptance } from '../services/acceptance';
import {
  clearIndexedDbKey,
  loadFromIndexedDb,
  saveToIndexedDb,
} from '../services/storage';

export type NavigationPageId =
  | 'overview'
  | 'explorer'
  | 'evidence'
  | 'correlation'
  | 'disagreement'
  | 'completeness'
  | 'causal-graph'
  | 'boundary'
  | 'reconstruction'
  | 'cryptography'
  | 'certificates'
  | 'validators'
  | 'experiments'
  | 'audit'
  | 'documentation'
  | 'settings';

export interface SavedExperimentSnapshot {
  snapshotId: string;
  name: string;
  savedAt: string;
  scenarioId: ScenarioId;
  checkpoint: CheckpointRecord | null;
  executionEvidence: ExecutionEvidence[];
  storageEvidence: StorageEvidence[];
  referenceEndState: StateObjectRecord[];
}

interface CausalChainContextValue {
  activePage: NavigationPageId;
  setActivePage: (page: NavigationPageId) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  network: NetworkId;
  setNetwork: (net: NetworkId) => void;
  rpcEndpoints: Record<NetworkId, string>;
  setRpcEndpoints: React.Dispatch<React.SetStateAction<Record<NetworkId, string>>>;
  liveBlockNumber: number | null;
  liveChainId: number | null;
  rpcConnected: boolean;
  rpcLatencyMs: number | null;
  refreshLiveNetworkStatus: () => Promise<void>;

  activeScenarioId: ScenarioId;
  checkpoint: CheckpointRecord | null;
  setCheckpoint: React.Dispatch<React.SetStateAction<CheckpointRecord | null>>;
  executionEvidence: ExecutionEvidence[];
  storageEvidence: StorageEvidence[];
  referenceEndState: StateObjectRecord[];
  workflowOutput: CompleteWorkflowOutput | null;
  isProcessing: boolean;

  validatorPolicy: 'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3';
  setValidatorPolicy: (policy: 'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3') => void;

  auditLogs: AuditLogEntry[];
  benchmarks: BenchmarkResult[];
  savedSnapshots: SavedExperimentSnapshot[];
  statsHistory: {
    successfulReconstructions: number;
    validCertificates: number;
    rejectedCertificates: number;
  };

  // Actions
  loadScenarioAndRun: (scenarioId: ScenarioId) => Promise<CompleteWorkflowOutput>;
  runAnalysisOnCurrentEvidence: (options?: {
    tamperCert?: boolean;
  }) => Promise<CompleteWorkflowOutput | null>;
  addExecutionEvidence: (
    record: Omit<ExecutionEvidence, 'evidenceHash'>
  ) => Promise<void>;
  addStorageEvidence: (
    record: Omit<StorageEvidence, 'evidenceHash'>
  ) => Promise<void>;
  updateStorageEvidence: (updated: StorageEvidence) => Promise<void>;
  deleteExecutionEvidence: (evidenceId: string) => Promise<void>;
  deleteStorageEvidence: (evidenceId: string) => Promise<void>;
  triggerCertificateTamperingDemo: () => Promise<void>;
  verifyUploadedCertificate: (cert: RecoveryCertificate) => Promise<void>;
  executeBenchmarkWorkload: (config: BenchmarkConfig) => Promise<BenchmarkResult>;
  saveCurrentSnapshot: (name: string) => Promise<void>;
  loadSnapshot: (snapshotId: string) => Promise<void>;
  resetAllDemoData: () => Promise<void>;
  importFullDatasetJson: (rawJson: string) => Promise<void>;

  // Guided Patent Workflow modal
  guidedModalOpen: boolean;
  setGuidedModalOpen: (open: boolean) => void;
  guidedStep: number;
  isGuidedRunning: boolean;
  startGuidedPatentWorkflow: () => Promise<void>;
}

const CausalChainContext = createContext<CausalChainContextValue | null>(null);

export const CausalChainProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activePage, setActivePage] = useState<NavigationPageId>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [network, setNetworkState] = useState<NetworkId>('mainnet');
  const [rpcEndpoints, setRpcEndpoints] = useState<Record<NetworkId, string>>({
    ...PUBLIC_RPC_ENDPOINTS,
  });
  const [liveBlockNumber, setLiveBlockNumber] = useState<number | null>(null);
  const [liveChainId, setLiveChainId] = useState<number | null>(null);
  const [rpcConnected, setRpcConnected] = useState<boolean>(false);
  const [rpcLatencyMs, setRpcLatencyMs] = useState<number | null>(null);

  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('SCENARIO_H');
  const [checkpoint, setCheckpoint] = useState<CheckpointRecord | null>(null);
  const [executionEvidence, setExecutionEvidence] = useState<ExecutionEvidence[]>([]);
  const [storageEvidence, setStorageEvidence] = useState<StorageEvidence[]>([]);
  const [referenceEndState, setReferenceEndState] = useState<StateObjectRecord[]>([]);
  const [workflowOutput, setWorkflowOutput] = useState<CompleteWorkflowOutput | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [validatorPolicy, setValidatorPolicyState] = useState<
    'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3'
  >('UNANIMOUS_3_OF_3');

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [savedSnapshots, setSavedSnapshots] = useState<SavedExperimentSnapshot[]>([]);
  const [statsHistory, setStatsHistory] = useState({
    successfulReconstructions: 1,
    validCertificates: 1,
    rejectedCertificates: 0,
  });

  const [guidedModalOpen, setGuidedModalOpen] = useState<boolean>(false);
  const [guidedStep, setGuidedStep] = useState<number>(0);
  const [isGuidedRunning, setIsGuidedRunning] = useState<boolean>(false);

  const appendAudit = useCallback(
    async (params: {
      eventType: AuditEventType;
      relatedTransaction?: string;
      relatedEvidence?: string;
      summary: string;
    }) => {
      setAuditLogs((prev) => {
        // Queue async hash computation safely
        return prev;
      });
      const currentChain =
        (await loadFromIndexedDb<AuditLogEntry[]>('auditLogs')) || auditLogs;
      const entry = await appendAuditLogEntry(currentChain, params);
      const updated = [...currentChain, entry];
      setAuditLogs(updated);
      await saveToIndexedDb('auditLogs', updated);
    },
    [auditLogs]
  );

  const refreshLiveNetworkStatus = useCallback(async () => {
    try {
      const status = await fetchNetworkStatus(network, rpcEndpoints[network]);
      setLiveBlockNumber(status.latestBlockNumber);
      setLiveChainId(status.chainId);
      setRpcConnected(true);
      setRpcLatencyMs(status.provenance.latencyMs);
    } catch {
      setRpcConnected(false);
    }
  }, [network, rpcEndpoints]);

  const setNetwork = useCallback((net: NetworkId) => {
    setNetworkState(net);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return next;
    });
  }, []);

  const loadScenarioAndRun = useCallback(
    async (scenarioId: ScenarioId): Promise<CompleteWorkflowOutput> => {
      setIsProcessing(true);
      try {
        const scenario = await buildScenarioDataset(scenarioId);
        setActiveScenarioId(scenarioId);
        setCheckpoint(scenario.checkpoint);
        setExecutionEvidence(scenario.executionEvidence);
        setStorageEvidence(scenario.storageEvidence);
        setReferenceEndState(scenario.referenceEndState);

        const output = await executeCompletePatentWorkflow({
          network,
          checkpoint: scenario.checkpoint,
          executionEvidence: scenario.executionEvidence,
          storageEvidence: scenario.storageEvidence,
          referenceEndState: scenario.referenceEndState,
          tamperCertificateAfterGen: Boolean(scenario.tamperCertificateAfterGen),
          validatorPolicy,
        });

        setWorkflowOutput(output);

        setStatsHistory((prev) => {
          const recSuccess =
            output.reconstruction.status === 'COMPLETED'
              ? prev.successfulReconstructions + 1
              : prev.successfulReconstructions;
          const certValid =
            output.validatorReport?.overallOutcome === 'ACCEPTED'
              ? prev.validCertificates + 1
              : prev.validCertificates;
          const certRejected =
            output.validatorReport?.overallOutcome === 'REJECTED' ||
            output.acceptanceReport.decision === 'REJECTED'
              ? prev.rejectedCertificates + 1
              : prev.rejectedCertificates;
          const next = {
            successfulReconstructions: recSuccess,
            validCertificates: certValid,
            rejectedCertificates: certRejected,
          };
          saveToIndexedDb('statsHistory', next);
          return next;
        });

        await appendAudit({
          eventType: 'SCENARIO_LOADED',
          summary: `Executed ${scenario.code}: ${scenario.title}. Boundary=${output.boundary.outcome}, Decision=${output.acceptanceReport.decision}.`,
        });

        await saveToIndexedDb('activeScenarioId', scenarioId);
        return output;
      } finally {
        setIsProcessing(false);
      }
    },
    [network, validatorPolicy, appendAudit]
  );

  const runAnalysisOnCurrentEvidence = useCallback(
    async (options?: {
      tamperCert?: boolean;
    }): Promise<CompleteWorkflowOutput | null> => {
      setIsProcessing(true);
      try {
        const output = await executeCompletePatentWorkflow({
          network,
          checkpoint,
          executionEvidence,
          storageEvidence,
          referenceEndState,
          tamperCertificateAfterGen: Boolean(options?.tamperCert),
          validatorPolicy,
        });
        setWorkflowOutput(output);

        await appendAudit({
          eventType: 'CORRELATION_EXECUTED',
          summary: `Correlated ${executionEvidence.length} execution and ${storageEvidence.length} storage records: ${
            output.disagreements.filter((d) => d.indicator !== '0').length
          } disagreement(s), Completeness=${output.completeness.status}, Boundary=${
            output.boundary.outcome
          }, Decision=${output.acceptanceReport.decision}.`,
        });

        return output;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      network,
      checkpoint,
      executionEvidence,
      storageEvidence,
      referenceEndState,
      validatorPolicy,
      appendAudit,
    ]
  );

  const addExecutionEvidence = useCallback(
    async (record: Omit<ExecutionEvidence, 'evidenceHash'>) => {
      const evidenceHash = await computeExecutionEvidenceHash(record);
      const fullRecord: ExecutionEvidence = { ...record, evidenceHash };
      const nextExec = [...executionEvidence, fullRecord];
      setExecutionEvidence(nextExec);

      const output = await executeCompletePatentWorkflow({
        network,
        checkpoint,
        executionEvidence: nextExec,
        storageEvidence,
        referenceEndState,
        validatorPolicy,
      });
      setWorkflowOutput(output);

      await appendAudit({
        eventType: 'EVIDENCE_CREATED',
        relatedTransaction: fullRecord.transactionId,
        relatedEvidence: fullRecord.evidenceId,
        summary: `Added execution evidence ${fullRecord.evidenceId} for ${fullRecord.transactionId} (source: ${fullRecord.evidenceSource}). Note: Storage evidence is never auto-fabricated.`,
      });
    },
    [
      executionEvidence,
      network,
      checkpoint,
      storageEvidence,
      referenceEndState,
      validatorPolicy,
      appendAudit,
    ]
  );

  const addStorageEvidence = useCallback(
    async (record: Omit<StorageEvidence, 'evidenceHash'>) => {
      const evidenceHash = await computeStorageEvidenceHash(record);
      const fullRecord: StorageEvidence = { ...record, evidenceHash };
      const nextStor = [...storageEvidence, fullRecord];
      setStorageEvidence(nextStor);

      const output = await executeCompletePatentWorkflow({
        network,
        checkpoint,
        executionEvidence,
        storageEvidence: nextStor,
        referenceEndState,
        validatorPolicy,
      });
      setWorkflowOutput(output);

      await appendAudit({
        eventType: 'EVIDENCE_CREATED',
        relatedTransaction: fullRecord.transactionId,
        relatedEvidence: fullRecord.evidenceId,
        summary: `Added storage-operation evidence ${fullRecord.evidenceId} on ${fullRecord.affectedStateObject} (status: ${fullRecord.commitStatus}).`,
      });
    },
    [
      storageEvidence,
      network,
      checkpoint,
      executionEvidence,
      referenceEndState,
      validatorPolicy,
      appendAudit,
    ]
  );

  const updateStorageEvidence = useCallback(
    async (updated: StorageEvidence) => {
      const recomputedHash = await computeStorageEvidenceHash(updated);
      const recordWithHash: StorageEvidence = {
        ...updated,
        evidenceHash: recomputedHash,
      };
      const nextStor = storageEvidence.map((s) =>
        s.evidenceId === updated.evidenceId ? recordWithHash : s
      );
      setStorageEvidence(nextStor);

      const output = await executeCompletePatentWorkflow({
        network,
        checkpoint,
        executionEvidence,
        storageEvidence: nextStor,
        referenceEndState,
        validatorPolicy,
      });
      setWorkflowOutput(output);

      await appendAudit({
        eventType: 'EVIDENCE_MODIFIED',
        relatedTransaction: recordWithHash.transactionId,
        relatedEvidence: recordWithHash.evidenceId,
        summary: `Modified storage evidence ${recordWithHash.evidenceId} (commitStatus=${recordWithHash.commitStatus}, v=${recordWithHash.stateVersion}).`,
      });
    },
    [
      storageEvidence,
      network,
      checkpoint,
      executionEvidence,
      referenceEndState,
      validatorPolicy,
      appendAudit,
    ]
  );

  const deleteExecutionEvidence = useCallback(
    async (evidenceId: string) => {
      const nextExec = executionEvidence.filter((e) => e.evidenceId !== evidenceId);
      setExecutionEvidence(nextExec);
      const output = await executeCompletePatentWorkflow({
        network,
        checkpoint,
        executionEvidence: nextExec,
        storageEvidence,
        referenceEndState,
        validatorPolicy,
      });
      setWorkflowOutput(output);
    },
    [
      executionEvidence,
      network,
      checkpoint,
      storageEvidence,
      referenceEndState,
      validatorPolicy,
    ]
  );

  const deleteStorageEvidence = useCallback(
    async (evidenceId: string) => {
      const nextStor = storageEvidence.filter((s) => s.evidenceId !== evidenceId);
      setStorageEvidence(nextStor);
      const output = await executeCompletePatentWorkflow({
        network,
        checkpoint,
        executionEvidence,
        storageEvidence: nextStor,
        referenceEndState,
        validatorPolicy,
      });
      setWorkflowOutput(output);
    },
    [
      storageEvidence,
      network,
      checkpoint,
      executionEvidence,
      referenceEndState,
      validatorPolicy,
    ]
  );

  const triggerCertificateTamperingDemo = useCallback(async () => {
    if (!workflowOutput || !workflowOutput.certificate) return;
    const tampered = tamperRecoveryCertificate(workflowOutput.certificate);
    const valReport = await runIndependentValidators({
      certificate: tampered,
      checkpoint,
      executionEvidence,
      storageEvidence,
      policy: validatorPolicy,
    });
    const accReport = await evaluateProtocolAcceptance({
      completeness: workflowOutput.completeness,
      boundary: workflowOutput.boundary,
      reconstruction: workflowOutput.reconstruction,
      certificate: tampered,
      validatorReport: valReport,
    });

    setWorkflowOutput({
      ...workflowOutput,
      certificate: tampered,
      validatorReport: valReport,
      acceptanceReport: accReport,
    });

    setStatsHistory((prev) => {
      const next = {
        ...prev,
        rejectedCertificates: prev.rejectedCertificates + 1,
      };
      saveToIndexedDb('statsHistory', next);
      return next;
    });

    await appendAudit({
      eventType: 'CERTIFICATE_TAMPERED',
      relatedEvidence: tampered.certificateId,
      summary: `Simulated post-generation tampering on certificate ${tampered.certificateId}. Independent validators outcome: ${valReport.overallOutcome}; Recovery decision: ${accReport.decision}.`,
    });
  }, [
    workflowOutput,
    checkpoint,
    executionEvidence,
    storageEvidence,
    validatorPolicy,
    appendAudit,
  ]);

  const verifyUploadedCertificate = useCallback(
    async (cert: RecoveryCertificate) => {
      if (!workflowOutput) return;
      const valReport = await runIndependentValidators({
        certificate: cert,
        checkpoint,
        executionEvidence,
        storageEvidence,
        policy: validatorPolicy,
      });
      const accReport = await evaluateProtocolAcceptance({
        completeness: workflowOutput.completeness,
        boundary: workflowOutput.boundary,
        reconstruction: workflowOutput.reconstruction,
        certificate: cert,
        validatorReport: valReport,
      });

      setWorkflowOutput({
        ...workflowOutput,
        certificate: cert,
        validatorReport: valReport,
        acceptanceReport: accReport,
      });

      await appendAudit({
        eventType: 'VALIDATOR_DECISION',
        relatedEvidence: cert.certificateId,
        summary: `Independent validators verified certificate ${cert.certificateId}: Consensus=${valReport.overallOutcome}, Protocol Decision=${accReport.decision}.`,
      });
    },
    [
      workflowOutput,
      checkpoint,
      executionEvidence,
      storageEvidence,
      validatorPolicy,
      appendAudit,
    ]
  );

  const setValidatorPolicy = useCallback(
    async (policy: 'UNANIMOUS_3_OF_3' | 'MAJORITY_2_OF_3') => {
      setValidatorPolicyState(policy);
      if (workflowOutput?.certificate) {
        const valReport = await runIndependentValidators({
          certificate: workflowOutput.certificate,
          checkpoint,
          executionEvidence,
          storageEvidence,
          policy,
        });
        const accReport = await evaluateProtocolAcceptance({
          completeness: workflowOutput.completeness,
          boundary: workflowOutput.boundary,
          reconstruction: workflowOutput.reconstruction,
          certificate: workflowOutput.certificate,
          validatorReport: valReport,
        });
        setWorkflowOutput({
          ...workflowOutput,
          validatorReport: valReport,
          acceptanceReport: accReport,
        });
      }
    },
    [workflowOutput, checkpoint, executionEvidence, storageEvidence]
  );

  const executeBenchmarkWorkload = useCallback(
    async (config: BenchmarkConfig): Promise<BenchmarkResult> => {
      setIsProcessing(true);
      try {
        const result = await runWorkloadBenchmark(config);
        const nextBenchmarks = [result, ...benchmarks];
        setBenchmarks(nextBenchmarks);
        await saveToIndexedDb('benchmarks', nextBenchmarks);

        await appendAudit({
          eventType: 'COMMITMENT_GENERATED',
          summary: `Executed benchmark ${result.benchmarkId} (${config.transactionCount} txs, ${config.mismatchPercentage}% mismatch): Detection=${result.metrics.disagreementDetectionRate}%, Latency=${result.timingsMs.totalRecoveryLatency}ms.`,
        });
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [benchmarks, appendAudit]
  );

  const saveCurrentSnapshot = useCallback(
    async (name: string) => {
      const snap: SavedExperimentSnapshot = {
        snapshotId: `SNAP-${Date.now().toString(36).toUpperCase()}`,
        name: name.trim() || `Experiment ${savedSnapshots.length + 1}`,
        savedAt: new Date().toISOString(),
        scenarioId: activeScenarioId,
        checkpoint,
        executionEvidence,
        storageEvidence,
        referenceEndState,
      };
      const next = [snap, ...savedSnapshots];
      setSavedSnapshots(next);
      await saveToIndexedDb('savedSnapshots', next);
    },
    [
      savedSnapshots,
      activeScenarioId,
      checkpoint,
      executionEvidence,
      storageEvidence,
      referenceEndState,
    ]
  );

  const loadSnapshot = useCallback(
    async (snapshotId: string) => {
      const snap = savedSnapshots.find((s) => s.snapshotId === snapshotId);
      if (!snap) return;
      setActiveScenarioId(snap.scenarioId);
      setCheckpoint(snap.checkpoint);
      setExecutionEvidence(snap.executionEvidence);
      setStorageEvidence(snap.storageEvidence);
      setReferenceEndState(snap.referenceEndState);

      const output = await executeCompletePatentWorkflow({
        network,
        checkpoint: snap.checkpoint,
        executionEvidence: snap.executionEvidence,
        storageEvidence: snap.storageEvidence,
        referenceEndState: snap.referenceEndState,
        validatorPolicy,
      });
      setWorkflowOutput(output);
    },
    [savedSnapshots, network, validatorPolicy]
  );

  const resetAllDemoData = useCallback(async () => {
    await clearIndexedDbKey('auditLogs');
    await clearIndexedDbKey('benchmarks');
    await clearIndexedDbKey('savedSnapshots');
    await clearIndexedDbKey('statsHistory');
    setAuditLogs([]);
    setBenchmarks([]);
    setSavedSnapshots([]);
    setStatsHistory({
      successfulReconstructions: 1,
      validCertificates: 1,
      rejectedCertificates: 0,
    });
    await loadScenarioAndRun('SCENARIO_H');
  }, [loadScenarioAndRun]);

  const importFullDatasetJson = useCallback(
    async (rawJson: string) => {
      const parsed = JSON.parse(rawJson);
      const nextCheckpoint = parsed.checkpoint ?? checkpoint;
      const nextExec = Array.isArray(parsed.executionEvidence)
        ? parsed.executionEvidence
        : executionEvidence;
      const nextStor = Array.isArray(parsed.storageEvidence)
        ? parsed.storageEvidence
        : storageEvidence;
      const nextRef = Array.isArray(parsed.referenceEndState)
        ? parsed.referenceEndState
        : referenceEndState;

      setCheckpoint(nextCheckpoint);
      setExecutionEvidence(nextExec);
      setStorageEvidence(nextStor);
      setReferenceEndState(nextRef);

      const output = await executeCompletePatentWorkflow({
        network,
        checkpoint: nextCheckpoint,
        executionEvidence: nextExec,
        storageEvidence: nextStor,
        referenceEndState: nextRef,
        validatorPolicy,
      });
      setWorkflowOutput(output);

      await appendAudit({
        eventType: 'SCENARIO_LOADED',
        summary: `Imported custom JSON dataset (${nextExec.length} execution records, ${nextStor.length} storage records).`,
      });
    },
    [
      checkpoint,
      executionEvidence,
      storageEvidence,
      referenceEndState,
      network,
      validatorPolicy,
      appendAudit,
    ]
  );

  const startGuidedPatentWorkflow = useCallback(async () => {
    setGuidedModalOpen(true);
    setIsGuidedRunning(true);
    setGuidedStep(1);

    await loadScenarioAndRun('SCENARIO_H');

    for (let step = 2; step <= 14; step++) {
      await new Promise((r) => setTimeout(r, 180));
      setGuidedStep(step);
    }
    setIsGuidedRunning(false);
  }, [loadScenarioAndRun]);

  // Initial load on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const savedAudit = await loadFromIndexedDb<AuditLogEntry[]>('auditLogs');
      const savedBench = await loadFromIndexedDb<BenchmarkResult[]>('benchmarks');
      const savedSnaps =
        await loadFromIndexedDb<SavedExperimentSnapshot[]>('savedSnapshots');
      const savedStats = await loadFromIndexedDb<typeof statsHistory>('statsHistory');

      if (mounted) {
        if (savedAudit && savedAudit.length > 0) setAuditLogs(savedAudit);
        if (savedBench && savedBench.length > 0) setBenchmarks(savedBench);
        else {
          // Run an initial 100-tx real benchmark so the Overview & Benchmarks charts show real measured numbers immediately
          const initialBench = await runWorkloadBenchmark({
            transactionCount: 100,
            stateObjectCount: 16,
            mismatchPercentage: 10,
            dependencyDensity: 'MEDIUM',
          });
          setBenchmarks([initialBench]);
          await saveToIndexedDb('benchmarks', [initialBench]);
        }
        if (savedSnaps) setSavedSnapshots(savedSnaps);
        if (savedStats) setStatsHistory(savedStats);
      }

      const scenario = await buildScenarioDataset('SCENARIO_H');
      const output = await executeCompletePatentWorkflow({
        network: 'mainnet',
        checkpoint: scenario.checkpoint,
        executionEvidence: scenario.executionEvidence,
        storageEvidence: scenario.storageEvidence,
        referenceEndState: scenario.referenceEndState,
        validatorPolicy: 'UNANIMOUS_3_OF_3',
      });

      if (mounted) {
        setCheckpoint(scenario.checkpoint);
        setExecutionEvidence(scenario.executionEvidence);
        setStorageEvidence(scenario.storageEvidence);
        setReferenceEndState(scenario.referenceEndState);
        setWorkflowOutput(output);

        if (!savedAudit || savedAudit.length === 0) {
          const e1 = await appendAuditLogEntry([], {
            eventType: 'SCENARIO_LOADED',
            summary:
              'Initialized CAUSALCHAIN platform with Scenario H (Bounded Recovery Dataset).',
          });
          const e2 = await appendAuditLogEntry([e1], {
            eventType: 'DISAGREEMENT_DETECTED',
            relatedTransaction: 'TX-101',
            relatedEvidence: 'STOR-H-01',
            summary:
              'Detected COMMIT_STATUS_CONFLICT (Δi = 1) on state object KA in TX-101 (Storage status: PERSISTED).',
          });
          const e3 = await appendAuditLogEntry([e1, e2], {
            eventType: 'BOUNDARY_CERTIFIED',
            relatedTransaction: 'TX-101, TX-102',
            summary: `Certified Causal Boundary ${output.boundary.boundaryId}: SB=[KA, KB], Preserved=[KC, KD].`,
          });
          const e4 = await appendAuditLogEntry([e1, e2, e3], {
            eventType: 'RECOVERY_DECISION',
            relatedEvidence: output.certificate?.certificateId,
            summary: `Independent Validators (3/3) verified certificate ${output.certificate?.certificateId}. Protocol Decision: ${output.acceptanceReport.decision}.`,
          });
          const initChain = [e1, e2, e3, e4];
          setAuditLogs(initChain);
          await saveToIndexedDb('auditLogs', initChain);
        }
      }
    })();

    refreshLiveNetworkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  // Refresh live network status when network changes
  useEffect(() => {
    refreshLiveNetworkStatus();
  }, [network, refreshLiveNetworkStatus]);

  return (
    <CausalChainContext.Provider
      value={{
        activePage,
        setActivePage,
        theme,
        toggleTheme,
        network,
        setNetwork,
        rpcEndpoints,
        setRpcEndpoints,
        liveBlockNumber,
        liveChainId,
        rpcConnected,
        rpcLatencyMs,
        refreshLiveNetworkStatus,
        activeScenarioId,
        checkpoint,
        setCheckpoint,
        executionEvidence,
        storageEvidence,
        referenceEndState,
        workflowOutput,
        isProcessing,
        validatorPolicy,
        setValidatorPolicy,
        auditLogs,
        benchmarks,
        savedSnapshots,
        statsHistory,
        loadScenarioAndRun,
        runAnalysisOnCurrentEvidence,
        addExecutionEvidence,
        addStorageEvidence,
        updateStorageEvidence,
        deleteExecutionEvidence,
        deleteStorageEvidence,
        triggerCertificateTamperingDemo,
        verifyUploadedCertificate,
        executeBenchmarkWorkload,
        saveCurrentSnapshot,
        loadSnapshot,
        resetAllDemoData,
        importFullDatasetJson,
        guidedModalOpen,
        setGuidedModalOpen,
        guidedStep,
        isGuidedRunning,
        startGuidedPatentWorkflow,
      }}
    >
      {children}
    </CausalChainContext.Provider>
  );
};

export function useCausalChain(): CausalChainContextValue {
  const ctx = useContext(CausalChainContext);
  if (!ctx) {
    throw new Error('useCausalChain must be used inside CausalChainProvider');
  }
  return ctx;
}
