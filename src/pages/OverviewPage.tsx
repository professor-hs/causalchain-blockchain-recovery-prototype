import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Cpu,
  Database,
  FileBadge,
  GitFork,
  Globe,
  Layers,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { SCENARIO_LIST } from '../data/scenarios';
import { ScenarioId } from '../types';

export const OverviewPage: React.FC = () => {
  const {
    network,
    liveBlockNumber,
    rpcConnected,
    checkpoint,
    executionEvidence,
    storageEvidence,
    workflowOutput,
    auditLogs,
    statsHistory,
    activeScenarioId,
    loadScenarioAndRun,
    setActivePage,
    startGuidedPatentWorkflow,
  } = useCausalChain();

  if (!workflowOutput) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Initializing CAUSALCHAIN recovery engine...
      </div>
    );
  }

  const {
    correlations,
    disagreements,
    completeness,
    boundary,
    reconstruction,
    validatorReport,
    acceptanceReport,
    stageTimingsMs,
  } = workflowOutput;

  const matchedCount = correlations.filter((c) => c.category === 'MATCHED').length;
  const activeDisagreements = disagreements.filter((d) => d.indicator !== '0');
  const unresolvedGaps = disagreements.filter(
    (d) => d.indicator === '⊥' || !d.resolvableFromEvidence
  );

  // Chart 1: Evidence Matching vs Disagreement Breakdown
  const matchingChartData = [
    { name: 'Matched (Δ=0)', count: matchedCount, fill: '#10b981' },
    {
      name: 'Confirmed Conflict (Δ=1)',
      count: disagreements.filter((d) => d.indicator === '1').length,
      fill: '#f59e0b',
    },
    {
      name: 'Indeterminate/Missing (Δ=⊥)',
      count: disagreements.filter((d) => d.indicator === '⊥').length,
      fill: '#ef4444',
    },
  ];

  // Chart 2: Transaction & State Activity Breakdown
  const txActivityData = executionEvidence.map((e) => ({
    tx: e.transactionId,
    reads: e.stateObjectsRead.length,
    writes: e.stateObjectsWritten.length,
    seq: e.executionSequence,
  }));

  // Chart 3: Completeness Rule Evaluation
  const completenessChartData = [
    {
      name: 'Passed Rules',
      value: completeness.ruleResults.filter((r) => r.status === 'PASS').length,
      fill: '#3b82f6',
    },
    {
      name: 'Warnings',
      value: completeness.ruleResults.filter((r) => r.status === 'WARN').length,
      fill: '#f59e0b',
    },
    {
      name: 'Failed Rules',
      value: completeness.ruleResults.filter((r) => r.status === 'FAIL').length,
      fill: '#ef4444',
    },
  ];

  // Chart 4: Recovery Decision & Certificate History Distribution
  const decisionDistData = [
    {
      name: 'Accepted Certificates',
      value: statsHistory.validCertificates,
      fill: '#10b981',
    },
    {
      name: 'Successful Reconstructions',
      value: statsHistory.successfulReconstructions,
      fill: '#3b82f6',
    },
    {
      name: 'Rejected/Tampered',
      value: statsHistory.rejectedCertificates,
      fill: '#ef4444',
    },
  ];

  // Chart 5: Boundary vs Unaffected State Reconstruction Status
  const reconstructionChartData = [
    {
      category: 'State Partition',
      Boundary_SB: boundary.stateObjectsInBoundary.length,
      Preserved_Unaffected: boundary.unaffectedStateObjects.length,
    },
  ];

  // Chart 6: Pipeline Stage Processing Time (ms)
  const stageTimingData = [
    { stage: 'Correlate', ms: stageTimingsMs.correlation },
    { stage: 'Disagree', ms: stageTimingsMs.disagreement },
    { stage: 'Complete', ms: stageTimingsMs.completeness },
    { stage: 'Causal BFS', ms: stageTimingsMs.causalPropagation },
    { stage: 'Boundary', ms: stageTimingsMs.boundaryCertification },
    { stage: 'Reconstruct', ms: stageTimingsMs.reconstruction },
    { stage: 'Cert+Sign', ms: stageTimingsMs.certificateGeneration },
    { stage: 'Validate', ms: stageTimingsMs.validatorVerification },
  ];

  const kpiCards = [
    {
      label: 'Current Blockchain Network',
      value: network === 'mainnet' ? 'Ethereum Mainnet' : 'Ethereum Sepolia',
      sub: rpcConnected ? 'PublicNode RPC Connected' : 'Local / Fallback Mode',
      icon: Globe,
      accent: 'text-blue-400',
    },
    {
      label: 'Latest Observed Block',
      value: liveBlockNumber
        ? `#${liveBlockNumber.toLocaleString()}`
        : `#${checkpoint?.blockNumber.toLocaleString() ?? '19,400,000'}`,
      sub: `Checkpoint: ${checkpoint?.checkpointId ?? 'None'}`,
      icon: Layers,
      accent: 'text-blue-400',
    },
    {
      label: 'Transactions Processed',
      value: String(executionEvidence.length),
      sub: `${correlations.length} state operations analyzed`,
      icon: Activity,
      accent: 'text-foreground',
    },
    {
      label: 'Execution Evidence (Ei)',
      value: String(executionEvidence.length),
      sub: `${
        executionEvidence.filter((e) => e.authenticationStatus === 'AUTHENTICATED')
          .length
      } authenticated records`,
      icon: Cpu,
      accent: 'text-blue-400',
    },
    {
      label: 'Storage Evidence (Dj)',
      value: String(storageEvidence.length),
      sub: `${
        storageEvidence.filter((s) => s.commitStatus === 'COMMITTED').length
      } committed operations`,
      icon: Database,
      accent: 'text-indigo-400',
    },
    {
      label: 'Matched Records (Δi = 0)',
      value: `${matchedCount} / ${correlations.length}`,
      sub: 'Cross-stream verified alignment',
      icon: CheckCircle2,
      accent: 'text-emerald-400',
    },
    {
      label: 'Disagreement Count',
      value: String(activeDisagreements.length),
      sub:
        activeDisagreements.length > 0
          ? activeDisagreements.map((d) => d.disagreementType).join(', ')
          : 'Zero active discrepancies',
      icon: AlertTriangle,
      accent: activeDisagreements.length > 0 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      label: 'Unresolved Evidence Gaps',
      value: String(unresolvedGaps.length),
      sub:
        unresolvedGaps.length === 0
          ? 'All dependencies resolvable'
          : 'Blocks reconstruction until resolved',
      icon: ShieldAlert,
      accent: unresolvedGaps.length > 0 ? 'text-rose-400' : 'text-emerald-400',
    },
    {
      label: 'Evidence Sufficiency Status',
      value: completeness.status,
      sub: `Coverage: ${completeness.descriptiveCoveragePercentage}% (Mandatory: ${
        completeness.mandatoryRulesPassed ? 'PASS' : 'FAIL'
      })`,
      icon: ShieldCheck,
      accent: completeness.canProceedToReconstruction
        ? 'text-emerald-400'
        : 'text-rose-400',
    },
    {
      label: 'Affected State Objects (SB)',
      value:
        boundary.stateObjectsInBoundary.length > 0
          ? boundary.stateObjectsInBoundary.join(', ')
          : 'None (0)',
      sub: `Preserved outside SB: ${
        boundary.unaffectedStateObjects.join(', ') || 'None'
      }`,
      icon: GitFork,
      accent: 'text-amber-400',
    },
    {
      label: 'Certified Causal Boundary',
      value: boundary.outcome,
      sub: `ID: ${boundary.boundaryId}`,
      icon: Shield,
      accent:
        boundary.outcome === 'CERTIFIED'
          ? 'text-emerald-400'
          : boundary.outcome === 'PROVISIONAL'
            ? 'text-amber-400'
            : 'text-rose-400',
    },
    {
      label: 'Selective Reconstructions',
      value: `${reconstruction.status} (${statsHistory.successfulReconstructions} Total)`,
      sub: `${reconstruction.appliedTransitions.length} verified transitions applied`,
      icon: Boxes,
      accent:
        reconstruction.status === 'COMPLETED'
          ? 'text-emerald-400'
          : 'text-amber-400',
    },
    {
      label: 'Valid Recovery Certificates',
      value: String(statsHistory.validCertificates),
      sub: `Active: ${
        validatorReport?.overallOutcome === 'ACCEPTED' ? 'VALID' : 'UNVERIFIED'
      }`,
      icon: FileBadge,
      accent: 'text-emerald-400',
    },
    {
      label: 'Rejected Certificates',
      value: String(statsHistory.rejectedCertificates),
      sub: `Protocol Decision: ${acceptanceReport.decision}`,
      icon: ShieldAlert,
      accent:
        acceptanceReport.decision === 'REJECTED'
          ? 'text-rose-400'
          : 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded">
            <span>PATENT PROTOTYPE</span>
            <span>•</span>
            <span>CAUSAL BOUNDARY CERTIFICATION & VERIFIED STATE RECONSTRUCTION</span>
          </div>
          <h2 className="text-lg lg:text-xl font-bold tracking-tight">
            System and Method for Evidence-Disagreement-Driven Causal Boundary Certification
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Acquires dual execution (<code className="font-mono text-foreground">Ei</code>) and
            storage-operation (<code className="font-mono text-foreground">Dj</code>) evidence
            streams, evaluates consistency predicates (<code className="font-mono text-foreground">Δi ∈ {'{0, 1, ⊥}'}</code>),
            propagates causal uncertainty across read-after-write and write-after-write dependency
            graphs, certifies minimal causal boundaries (<code className="font-mono text-foreground">B = (SB, TB, EB, CB, UB)</code>),
            and executes cryptographically verified selective state reconstruction (<code className="font-mono text-foreground">SB' = Apply(SC, TBv)</code>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => startGuidedPatentWorkflow()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            Run Complete Patent Workflow
          </button>
          <button
            onClick={() => setActivePage('experiments')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md text-xs font-medium bg-secondary hover:bg-accent text-foreground border border-border transition-colors"
          >
            Open Experiment Lab
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Scenario Switcher Strip */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Interactive Experiment Scenarios (Click to Execute Real Algorithm Pipeline)
          </h3>
          <span className="text-xs font-mono text-blue-400">
            Active: {activeScenarioId}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {SCENARIO_LIST.map((s) => {
            const active = activeScenarioId === s.id;
            return (
              <button
                key={s.id}
                data-testid={`overview-scenario-${s.id}`}
                onClick={() => loadScenarioAndRun(s.id as ScenarioId)}
                className={`p-2.5 rounded-md border text-left transition-all ${
                  active
                    ? 'bg-blue-600/20 border-blue-500 text-foreground'
                    : 'bg-secondary/40 border-border hover:bg-accent text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-blue-400 font-semibold">{s.code}</span>
                  <span className="px-1 py-0.2 rounded bg-background/60">{s.badge}</span>
                </div>
                <div className="text-xs font-medium leading-snug line-clamp-2">
                  {s.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 14 Real-Time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-card border border-border rounded-lg p-3.5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] text-muted-foreground font-medium leading-tight">
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 shrink-0 ${card.accent}`} />
              </div>
              <div>
                <div className={`text-sm font-bold font-mono truncate ${card.accent}`}>
                  {card.value}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  {card.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6 Interactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Evidence Matching vs Disagreement */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            1. Evidence Matching vs Disagreement
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Distribution of consistency indicator Δi across correlated operations
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={matchingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {matchingChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Transaction Activity Chart */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            2. Transaction Read/Write State Activity
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            State objects read (Ri) and written (Wi) per execution sequence
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={txActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis dataKey="tx" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="reads" name="State Reads (Ri)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="writes" name="State Writes (Wi)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Evidence Completeness Rules */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            3. Evidence Completeness Assessment (10 Rules)
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Descriptive Coverage: {completeness.descriptiveCoveragePercentage}% • Status:{' '}
            <strong className="text-foreground">{completeness.status}</strong>
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={completenessChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {completenessChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Recovery Decision Distribution */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            4. Recovery & Certificate Decision Distribution
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Cumulative reconstructions, accepted certificates, and rejected recoveries
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decisionDistData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={130}
                  tick={{ fontSize: 10 }}
                  stroke="#94a3b8"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {decisionDistData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Reconstruction & State Preservation Status */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            5. Selective Reconstruction Partition (SB vs Preserved)
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Boundary SB state objects vs verified unaffected state objects
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reconstructionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="Boundary_SB"
                  name="Reconstructed Boundary (SB)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Preserved_Unaffected"
                  name="Preserved Unaffected State"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 6: Pipeline Stage Processing Latency */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            6. Real-Time Pipeline Stage Latency (ms)
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Measured execution time across all 8 recovery engine stages ({stageTimingsMs.total}ms total)
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageTimingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis dataKey="stage" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="ms" name="Latency (ms)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row: Protocol Decision Summary & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Protocol Recovery Report */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Active Protocol State Acceptance Report
            </h3>
            <span
              data-testid="overview-protocol-decision"
              className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                acceptanceReport.decision === 'ACCEPTED'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : acceptanceReport.decision === 'SUSPENDED'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}
            >
              {acceptanceReport.decision}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {acceptanceReport.reasons.join(' ')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            {Object.entries(acceptanceReport.conditions).map(([key, passed]) => (
              <div
                key={key}
                className="p-2 rounded bg-secondary/40 border border-border flex items-center gap-2 text-xs"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    passed ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <span className="truncate font-mono text-[11px]">{key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Hash-Linked Audit Activity Feed */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Recent Hash-Linked Audit Activity Feed
            </h3>
            <button
              onClick={() => setActivePage('audit')}
              className="text-xs text-blue-400 hover:underline font-medium"
            >
              View Full Chain ({auditLogs.length})
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {auditLogs
              .slice()
              .reverse()
              .slice(0, 6)
              .map((entry) => (
                <div
                  key={entry.eventId}
                  className="p-2.5 rounded bg-secondary/30 border border-border/70 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-blue-400 font-semibold">
                        {entry.eventId}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-accent">
                        {entry.eventType}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      {entry.summary}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[10px] text-muted-foreground shrink-0">
                    <div>#{entry.sequence}</div>
                    <div>{entry.currentAuditHash.slice(0, 8)}...</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
