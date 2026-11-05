import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Download,
  FlaskConical,
  Loader2,
  Play,
  Gauge,
} from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { buildScenarioDataset, SCENARIO_LIST } from '../data/scenarios';
import {
  BenchmarkConfig,
  ExperimentScenarioDefinition,
  ScenarioId,
} from '../types';
import { downloadCsvFile, downloadJsonFile } from '../services/storage';

export const ExperimentsBenchmarksPage: React.FC = () => {
  const {
    activeScenarioId,
    loadScenarioAndRun,
    workflowOutput,
    benchmarks,
    executeBenchmarkWorkload,
    isProcessing,
    setActivePage,
  } = useCausalChain();

  const [scenarioMeta, setScenarioMeta] =
    useState<ExperimentScenarioDefinition | null>(null);
  const [txWorkload, setTxWorkload] =
    useState<BenchmarkConfig['transactionCount']>(100);
  const [stateObjCount, setStateObjCount] = useState<number>(24);
  const [mismatchPct, setMismatchPct] = useState<number>(10);
  const [depDensity, setDepDensity] =
    useState<BenchmarkConfig['dependencyDensity']>('MEDIUM');

  useEffect(() => {
    buildScenarioDataset(activeScenarioId).then(setScenarioMeta);
  }, [activeScenarioId]);

  const latestBenchmark = benchmarks[0] ?? null;

  const handleExportBenchmarkCsv = () => {
    if (benchmarks.length === 0) return;
    const headers = [
      'BenchmarkID',
      'Timestamp',
      'Transactions',
      'StateObjects',
      'MismatchPct',
      'DependencyDensity',
      'TotalLatencyMs',
      'DetectionRatePct',
      'FalsePositiveRatePct',
      'BoundaryPrecisionPct',
      'BoundaryRecallPct',
      'ReconstructionCorrectnessPct',
      'StatePreservationRatePct',
    ];
    const rows = benchmarks.map((b) => [
      b.benchmarkId,
      b.timestamp,
      b.config.transactionCount,
      b.config.stateObjectCount,
      b.config.mismatchPercentage,
      b.config.dependencyDensity,
      b.timingsMs.totalRecoveryLatency,
      b.metrics.disagreementDetectionRate,
      b.metrics.falsePositiveRate,
      b.metrics.causalBoundaryPrecision,
      b.metrics.causalBoundaryRecall,
      b.metrics.reconstructionCorrectness,
      b.metrics.statePreservationRate,
    ]);
    downloadCsvFile('causalchain-benchmarks.csv', headers, rows);
  };

  return (
    <div className="space-y-8">
      {/* Section 21: Experiment & Attack Simulation Laboratory */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold">
                Experiment & Attack Simulation Laboratory (Module 21 — Scenarios A–H)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Select and execute any of the 8 predefined patent verification scenarios.
              Every scenario runs the real correlation, disagreement, completeness, BFS causal
              propagation, boundary certification, reconstruction, and validator engines.
            </p>
          </div>
        </div>

        {/* 8 Scenario Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SCENARIO_LIST.map((sc) => {
            const isSelected = activeScenarioId === sc.id;
            return (
              <div
                key={sc.id}
                className={`p-4 rounded-lg border flex flex-col justify-between gap-3 transition-all ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500'
                    : 'bg-secondary/30 border-border hover:bg-secondary/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="font-bold text-blue-400">{sc.code}</span>
                    <span className="px-2 py-0.5 rounded bg-background/70 text-[10px]">
                      {sc.badge}
                    </span>
                  </div>
                  <div className="text-xs font-semibold leading-snug">
                    {sc.title}
                  </div>
                </div>
                <button
                  data-testid={`run-${sc.id}`}
                  onClick={() => loadScenarioAndRun(sc.id as ScenarioId)}
                  disabled={isProcessing}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run {sc.code}
                </button>
              </div>
            );
          })}
        </div>

        {/* Active Scenario Detailed Output Report */}
        {scenarioMeta && workflowOutput && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="text-xs font-mono text-blue-400 font-bold">
                  ACTIVE EXPERIMENT REPORT: {scenarioMeta.code} — {scenarioMeta.title}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {scenarioMeta.description}
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2.5 py-1 rounded bg-background border border-border">
                  Boundary: <strong>{workflowOutput.boundary.outcome}</strong>
                </span>
                <span
                  data-testid="experiment-final-decision"
                  className={`px-3 py-1 rounded border font-bold ${
                    workflowOutput.acceptanceReport.decision === 'ACCEPTED'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : workflowOutput.acceptanceReport.decision === 'SUSPENDED'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                >
                  Decision: {workflowOutput.acceptanceReport.decision}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Input Dataset</div>
                <div className="font-bold mt-0.5">
                  {scenarioMeta.executionEvidence.length} Ei /{' '}
                  {scenarioMeta.storageEvidence.length} Dj
                </div>
              </div>
              <div className="p-2.5 rounded bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Detected Issues</div>
                <div className="font-bold mt-0.5 text-amber-400">
                  {
                    workflowOutput.disagreements.filter((d) => d.indicator !== '0')
                      .length
                  }{' '}
                  Discrepancy(ies)
                </div>
              </div>
              <div className="p-2.5 rounded bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Completeness</div>
                <div className="font-bold mt-0.5">
                  {workflowOutput.completeness.status}
                </div>
              </div>
              <div className="p-2.5 rounded bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Boundary SB</div>
                <div className="font-bold mt-0.5 truncate">
                  [{workflowOutput.boundary.stateObjectsInBoundary.join(', ') || '∅'}]
                </div>
              </div>
              <div className="p-2.5 rounded bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Reconstruction</div>
                <div className="font-bold mt-0.5">
                  {workflowOutput.reconstruction.status}
                </div>
              </div>
              <div className="p-2.5 rounded bg-background border border-border">
                <div className="text-[10px] text-muted-foreground">Validators</div>
                <div className="font-bold mt-0.5">
                  {workflowOutput.validatorReport?.overallOutcome ?? 'N/A'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => setActivePage('causal-graph')}
                className="px-3 py-1 rounded text-xs bg-accent hover:bg-blue-500/20 text-blue-400 border border-blue-500/30"
              >
                Inspect Causal Dependency Graph
              </button>
              <button
                onClick={() => setActivePage('reconstruction')}
                className="px-3 py-1 rounded text-xs bg-accent hover:bg-blue-500/20 text-blue-400 border border-blue-500/30"
              >
                Inspect Reconstructed State
              </button>
              <button
                onClick={() => setActivePage('certificates')}
                className="px-3 py-1 rounded text-xs bg-accent hover:bg-blue-500/20 text-blue-400 border border-blue-500/30"
              >
                Inspect Recovery Certificate
              </button>
              <button
                onClick={() => setActivePage('validators')}
                className="px-3 py-1 rounded text-xs bg-accent hover:bg-blue-500/20 text-blue-400 border border-blue-500/30"
              >
                Inspect Validator Consensus
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 22: Performance Benchmarking Laboratory */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold">
                Performance Benchmarking Suite (Module 22 — 100 to 10,000 Transactions)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Generates synthetic transaction workloads with configurable state object
              counts, mismatch percentages, and dependency densities. Evaluates against an
              independently calculated reference state and records actual measured execution latencies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBenchmarkCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary hover:bg-accent border border-border text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={() =>
                downloadJsonFile('causalchain-benchmarks.json', benchmarks)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary hover:bg-accent border border-border text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Benchmark Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Workload Size (Transactions)
            </label>
            <select
              value={txWorkload}
              onChange={(e) =>
                setTxWorkload(
                  Number(e.target.value) as BenchmarkConfig['transactionCount']
                )
              }
              className="w-full bg-background border border-border rounded px-3 py-2 font-mono"
            >
              <option value={100}>100 Transactions</option>
              <option value={500}>500 Transactions</option>
              <option value={1000}>1,000 Transactions</option>
              <option value={5000}>5,000 Transactions</option>
              <option value={10000}>10,000 Transactions</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              State Objects Count
            </label>
            <input
              type="number"
              min={8}
              max={200}
              value={stateObjCount}
              onChange={(e) => setStateObjCount(Number(e.target.value))}
              className="w-full bg-background border border-border rounded px-3 py-1.5 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Evidence Mismatch % ({mismatchPct}%)
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={mismatchPct}
              onChange={(e) => setMismatchPct(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Dependency Graph Density
            </label>
            <select
              value={depDensity}
              onChange={(e) =>
                setDepDensity(
                  e.target.value as BenchmarkConfig['dependencyDensity']
                )
              }
              className="w-full bg-background border border-border rounded px-3 py-2 font-mono"
            >
              <option value="LOW">LOW Density</option>
              <option value="MEDIUM">MEDIUM Density</option>
              <option value="HIGH">HIGH Density</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              data-testid="execute-benchmark-btn"
              onClick={() =>
                executeBenchmarkWorkload({
                  transactionCount: txWorkload,
                  stateObjectCount: stateObjCount,
                  mismatchPercentage: mismatchPct,
                  dependencyDensity: depDensity,
                })
              }
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              Run Benchmark ({txWorkload.toLocaleString()} Txs)
            </button>
          </div>
        </div>

        {/* 10 Measured Benchmark Metrics */}
        {latestBenchmark && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  1. Disagreement Detection Rate
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {latestBenchmark.metrics.disagreementDetectionRate}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  2. False-Positive Rate
                </div>
                <div className="text-sm font-bold text-blue-400 mt-1">
                  {latestBenchmark.metrics.falsePositiveRate}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  3. Sufficiency Accuracy
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {latestBenchmark.metrics.evidenceSufficiencyAccuracy}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  4. Boundary Precision
                </div>
                <div className="text-sm font-bold text-amber-400 mt-1">
                  {latestBenchmark.metrics.causalBoundaryPrecision}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  5. Boundary Recall
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {latestBenchmark.metrics.causalBoundaryRecall}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  6. Reconstruction Correctness
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {latestBenchmark.metrics.reconstructionCorrectness}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  7. State Preservation Rate
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {latestBenchmark.metrics.statePreservationRate}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  8. Cert Verification Success
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {latestBenchmark.metrics.certificateVerificationSuccessRate}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  9. Invalid Cert Rejection Rate
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-1">
                  {latestBenchmark.metrics.invalidCertificateRejectionRate}%
                </div>
              </div>
              <div className="p-3 rounded bg-secondary/40 border border-border">
                <div className="text-[10px] text-muted-foreground">
                  10. Total Recovery Latency
                </div>
                <div className="text-sm font-bold text-blue-400 mt-1">
                  {latestBenchmark.metrics.recoveryLatencyMs} ms
                </div>
              </div>
            </div>

            {/* Stage Timing Chart for Latest Benchmark */}
            <div className="h-60 p-4 rounded bg-secondary/20 border border-border">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Measured Stage Latencies (ms) — {latestBenchmark.config.transactionCount.toLocaleString()} Transactions ({latestBenchmark.benchmarkId})
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart
                  data={[
                    {
                      stage: 'Evidence Corr',
                      ms: latestBenchmark.timingsMs.evidenceProcessingTime,
                    },
                    {
                      stage: 'Disagreement',
                      ms: latestBenchmark.timingsMs.disagreementDetectionTime,
                    },
                    {
                      stage: 'Completeness',
                      ms: latestBenchmark.timingsMs.completenessAssessmentTime,
                    },
                    {
                      stage: 'Causal BFS',
                      ms: latestBenchmark.timingsMs.dependencyTraversalTime,
                    },
                    {
                      stage: 'Boundary Cert',
                      ms: latestBenchmark.timingsMs.boundaryCertificationTime,
                    },
                    {
                      stage: 'Reconstruction',
                      ms: latestBenchmark.timingsMs.reconstructionTime,
                    },
                    {
                      stage: 'SHA-256 + Cert',
                      ms: latestBenchmark.timingsMs.hashGenerationTime,
                    },
                    {
                      stage: 'Cert Verify',
                      ms: latestBenchmark.timingsMs.certificateVerificationTime,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="ms"
                    name="Measured Time (ms)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
