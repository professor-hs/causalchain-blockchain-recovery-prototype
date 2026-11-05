import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  FileBadge,
  FlaskConical,
  GitCompare,
  GitFork,
  Globe,
  History,
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  Play,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import {
  NavigationPageId,
  useCausalChain,
} from '../hooks/useCausalChainStore';
import { SCENARIO_LIST } from '../data/scenarios';
import { ScenarioId } from '../types';
import { GuidedWorkflowModal } from '../components/GuidedWorkflowModal';

interface NavItem {
  id: NavigationPageId;
  label: string;
  shortCode: string;
  icon: React.FC<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', shortCode: '01', icon: LayoutDashboard },
  { id: 'explorer', label: 'Live Blockchain Explorer', shortCode: '02', icon: Globe },
  { id: 'evidence', label: 'Evidence Acquisition', shortCode: '03', icon: Database },
  { id: 'correlation', label: 'Evidence Correlation', shortCode: '04', icon: GitCompare },
  { id: 'disagreement', label: 'Disagreement Detection', shortCode: '05', icon: AlertOctagon },
  { id: 'completeness', label: 'Evidence Completeness', shortCode: '06', icon: CheckCircle2 },
  { id: 'causal-graph', label: 'Causal Dependency Graph', shortCode: '07', icon: GitFork },
  { id: 'boundary', label: 'Boundary Certification', shortCode: '08', icon: Shield },
  { id: 'reconstruction', label: 'State Reconstruction', shortCode: '09', icon: Boxes },
  { id: 'cryptography', label: 'Cryptographic Verification', shortCode: '10', icon: Lock },
  { id: 'certificates', label: 'Recovery Certificates', shortCode: '11', icon: FileBadge },
  { id: 'validators', label: 'Independent Validators', shortCode: '12', icon: ShieldCheck },
  { id: 'experiments', label: 'Experiments & Benchmarks', shortCode: '13', icon: FlaskConical },
  { id: 'audit', label: 'Audit Logs', shortCode: '14', icon: History },
  { id: 'documentation', label: 'Patent & Architecture Docs', shortCode: '15', icon: BookOpen },
  { id: 'settings', label: 'System Settings', shortCode: '16', icon: Settings },
];

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    activePage,
    setActivePage,
    theme,
    toggleTheme,
    network,
    setNetwork,
    liveBlockNumber,
    rpcConnected,
    rpcLatencyMs,
    refreshLiveNetworkStatus,
    activeScenarioId,
    loadScenarioAndRun,
    workflowOutput,
    startGuidedPatentWorkflow,
  } = useCausalChain();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const decision = workflowOutput?.acceptanceReport.decision ?? 'PENDING';
  const decisionBadgeClass =
    decision === 'ACCEPTED'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : decision === 'SUSPENDED'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-400 border-rose-500/30';

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } hidden md:flex flex-col border-r border-border bg-card/80 transition-all duration-200 shrink-0`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-border">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-bold tracking-wider text-sm flex items-center gap-1.5">
                  <span>CAUSALCHAIN</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    v1.0
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Evidence-Driven Recovery
                </div>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Cpu className="w-4 h-4" />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => setActivePage(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    <span className="text-[10px] font-mono opacity-50">
                      {item.shortCode}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-border bg-muted/20 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Protocol Status</span>
              <span
                data-testid="sidebar-protocol-decision"
                className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-semibold ${decisionBadgeClass}`}
              >
                {decision}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Boundary</span>
              <span className="font-mono text-foreground">
                {workflowOutput?.boundary.outcome ?? 'N/A'}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden p-2 rounded border border-border hover:bg-accent"
              aria-label="Toggle Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm lg:text-base font-semibold tracking-tight truncate">
                  {NAV_ITEMS.find((n) => n.id === activePage)?.label ?? 'CAUSALCHAIN'}
                </h1>
                <span className="hidden sm:inline-block text-xs text-muted-foreground">
                  • Evidence-Driven Blockchain State Recovery & Verification Platform
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Scenario Switcher */}
            <div className="hidden xl:flex items-center gap-1.5 bg-secondary/60 border border-border rounded-md px-2 py-1">
              <span className="text-[11px] text-muted-foreground font-medium">
                Scenario:
              </span>
              <select
                aria-label="Select Experiment Scenario"
                data-testid="topbar-scenario-select"
                value={activeScenarioId}
                onChange={(e) => loadScenarioAndRun(e.target.value as ScenarioId)}
                className="bg-transparent text-xs font-mono text-foreground focus:outline-none cursor-pointer"
              >
                {SCENARIO_LIST.map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                    className="bg-card text-foreground"
                  >
                    {s.code}: {s.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Network Selector & RPC Status */}
            <div className="flex items-center gap-1.5 bg-secondary/60 border border-border rounded-md px-2.5 py-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  rpcConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <select
                aria-label="Select Ethereum Network"
                data-testid="network-selector"
                value={network}
                onChange={(e) =>
                  setNetwork(e.target.value as 'mainnet' | 'sepolia')
                }
                className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
              >
                <option value="mainnet" className="bg-card text-foreground">
                  Ethereum Mainnet
                </option>
                <option value="sepolia" className="bg-card text-foreground">
                  Ethereum Sepolia
                </option>
              </select>
              {liveBlockNumber && (
                <span className="hidden sm:inline font-mono text-[11px] text-blue-400 border-l border-border pl-2">
                  #{liveBlockNumber.toLocaleString()}
                </span>
              )}
              {rpcLatencyMs !== null && (
                <span className="hidden lg:inline font-mono text-[10px] text-muted-foreground">
                  ({rpcLatencyMs}ms)
                </span>
              )}
              <button
                onClick={() => refreshLiveNetworkStatus()}
                className="p-0.5 hover:text-blue-400 text-muted-foreground"
                title="Refresh Live RPC Block"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Run Complete Patent Workflow CTA */}
            <button
              data-testid="run-complete-workflow-btn"
              onClick={() => startGuidedPatentWorkflow()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Complete Patent Workflow</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md border border-border bg-secondary/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-card border-b border-border p-3 grid grid-cols-2 gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded text-xs font-medium ${
                    activePage === item.id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Provenance Banner */}
        <div className="bg-blue-950/30 border-b border-blue-500/20 px-4 lg:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              <strong className="text-foreground">Provenance Distinction:</strong> Live
              Ethereum JSON-RPC observations (PublicNode) are strictly separated from
              controlled experimental storage-operation simulations.
            </span>
          </div>
          <div className="font-mono text-[11px] flex items-center gap-3">
            <span>
              Active Dataset:{' '}
              <strong className="text-blue-400">{activeScenarioId}</strong>
            </span>
            <span>
              Pipeline Latency:{' '}
              <strong className="text-foreground">
                {workflowOutput?.stageTimingsMs.total ?? 0}ms
              </strong>
            </span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>

      <GuidedWorkflowModal />
    </div>
  );
};
