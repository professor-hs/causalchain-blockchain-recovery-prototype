import React, { useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Edge,
  MarkerType,
  Node,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitFork, Info } from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { CausalNode, CausalNodeVisualState } from '../types';

function getNodeVisualColors(visualState: CausalNodeVisualState): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  switch (visualState) {
    case 'INCONSISTENT':
      return {
        bg: '#3f121d',
        border: '#f43f5e',
        text: '#fecdd3',
        badge: 'DIRECT INCONSISTENT U(0)',
      };
    case 'POTENTIALLY_AFFECTED':
      return {
        bg: '#422006',
        border: '#f59e0b',
        text: '#fde68a',
        badge: 'TRANSITIVELY AFFECTED U(k)',
      };
    case 'UNRESOLVED':
      return {
        bg: '#3b0764',
        border: '#c084fc',
        text: '#f3e8ff',
        badge: 'UNRESOLVED DEPENDENCY (⊥)',
      };
    case 'VERIFIED_UNAFFECTED':
    case 'MATCHED':
    default:
      return {
        bg: '#062e22',
        border: '#10b981',
        text: '#a7f3d0',
        badge: 'VERIFIED UNAFFECTED',
      };
  }
}

export const CausalGraphPage: React.FC = () => {
  const { workflowOutput } = useCausalChain();
  const [selectedNode, setSelectedNode] = useState<CausalNode | null>(null);

  if (!workflowOutput) return null;
  const { causalGraph } = workflowOutput;

  const { flowNodes, flowEdges } = useMemo(() => {
    const ckptNodes = causalGraph.nodes.filter((n) => n.nodeType === 'CHECKPOINT');
    const txNodes = causalGraph.nodes.filter(
      (n) =>
        n.nodeType === 'TRANSACTION' ||
        n.nodeType === 'VERIFIED' ||
        (n.nodeType === 'DISAGREEMENT' && n.id.startsWith('TX:')) ||
        n.nodeType === 'UNCERTAIN_DEPENDENCY'
    );
    const stateNodes = causalGraph.nodes.filter(
      (n) =>
        n.nodeType === 'STATE_OBJECT' ||
        (n.nodeType === 'DISAGREEMENT' && n.id.startsWith('STATE:'))
    );

    const nodes: Node[] = [];

    ckptNodes.forEach((n, idx) => {
      const style = getNodeVisualColors(n.visualState);
      nodes.push({
        id: n.id,
        position: { x: 40, y: 120 + idx * 110 },
        data: { label: `${n.label}\n[${style.badge}]` },
        style: {
          background: style.bg,
          color: style.text,
          border: `2px solid ${style.border}`,
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          padding: '8px 10px',
          width: 220,
          whiteSpace: 'pre-wrap',
        },
      });
    });

    txNodes.forEach((n, idx) => {
      const style = getNodeVisualColors(n.visualState);
      nodes.push({
        id: n.id,
        position: { x: 340, y: 40 + idx * 115 },
        data: { label: `${n.label}\n[${style.badge}]` },
        style: {
          background: style.bg,
          color: style.text,
          border: `2px solid ${style.border}`,
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          padding: '8px 10px',
          width: 230,
          whiteSpace: 'pre-wrap',
        },
      });
    });

    stateNodes.forEach((n, idx) => {
      const style = getNodeVisualColors(n.visualState);
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      nodes.push({
        id: n.id,
        position: { x: 650 + col * 240, y: 30 + row * 100 },
        data: { label: `${n.label}\n[${style.badge}]` },
        style: {
          background: style.bg,
          color: style.text,
          border: `2px solid ${style.border}`,
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          padding: '8px 10px',
          width: 215,
          whiteSpace: 'pre-wrap',
        },
      });
    });

    const edges: Edge[] = causalGraph.edges.map((e) => {
      const sourceNode = causalGraph.nodes.find((n) => n.id === e.source);
      const targetNode = causalGraph.nodes.find((n) => n.id === e.target);
      const isUncertainEdge =
        sourceNode &&
        targetNode &&
        sourceNode.visualState !== 'VERIFIED_UNAFFECTED' &&
        targetNode.visualState !== 'VERIFIED_UNAFFECTED';

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.dependencyType.replace(/_/g, ' '),
        animated: Boolean(isUncertainEdge),
        style: {
          stroke: isUncertainEdge ? '#f59e0b' : '#475569',
          strokeWidth: isUncertainEdge ? 2 : 1.2,
        },
        labelStyle: {
          fill: '#94a3b8',
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isUncertainEdge ? '#f59e0b' : '#475569',
        },
      };
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [causalGraph]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2">
          <GitFork className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold">
            Causal Dependency Graph & Uncertainty Propagation Engine (Module 14)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Models transaction and state-version lineage{' '}
          <code className="font-mono text-foreground">G = (N, E)</code> across
          Read-After-Write (<code className="font-mono">RAW</code>), Write-After-Write (<code className="font-mono">WAW</code>),
          and State-Version Lineage edges. Propagates uncertainty iteratively via BFS:{' '}
          <code className="font-mono text-foreground">
            U(k+1) = U(k) ∪ {'{v | ∃ u ∈ U(k) ∧ (u → v) ∈ E}'}
          </code>
          . Downstream transactions without a causal edge from <code className="font-mono">U(k)</code> remain{' '}
          <strong className="text-emerald-400">VERIFIED_UNAFFECTED</strong>.
        </p>

        {/* Legend & Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-xs">
          <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30">
            <div className="font-mono font-bold text-rose-400">
              Directly Inconsistent U(0): {causalGraph.directlyInconsistentNodes.length}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              {causalGraph.directlyInconsistentNodes.join(', ') || 'None'}
            </div>
          </div>
          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30">
            <div className="font-mono font-bold text-amber-400">
              Transitively Affected U(k≥1): {causalGraph.transitivelyAffectedNodes.length}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              {causalGraph.transitivelyAffectedNodes.join(', ') || 'None'}
            </div>
          </div>
          <div className="p-2.5 rounded bg-purple-500/10 border border-purple-500/30">
            <div className="font-mono font-bold text-purple-400">
              Unresolved Dependency (⊥): {causalGraph.unresolvedDependencyNodes.length}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              {causalGraph.unresolvedDependencyNodes.join(', ') || 'None'}
            </div>
          </div>
          <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30">
            <div className="font-mono font-bold text-emerald-400">
              Verified Unaffected: {causalGraph.verifiedUnaffectedNodes.length}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              Preserved outside boundary
            </div>
          </div>
        </div>
      </div>

      {/* Interactive React Flow Canvas */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">
            Interactive Causal Graph Canvas (Click any node to inspect inclusion reason & evidence references)
          </span>
          <span className="font-mono text-[11px] text-blue-400">
            {causalGraph.nodes.length} Nodes • {causalGraph.edges.length} Dependency Edges
          </span>
        </div>
        <div style={{ height: 480 }} className="w-full bg-slate-950">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            onNodeClick={(_, node) => {
              const found = causalGraph.nodes.find((n) => n.id === node.id);
              if (found) setSelectedNode(found);
            }}
          >
            <Background color="#334155" gap={20} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Node Inspector & BFS Iteration Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="w-4 h-4 text-blue-400" />
            <span>Clicked Node Evidence & Inclusion Inspector</span>
          </div>
          {selectedNode ? (
            <div className="p-3 rounded bg-secondary/40 border border-border text-xs space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-400">{selectedNode.id}</span>
                <span className="px-2 py-0.5 rounded bg-accent text-[10px]">
                  {selectedNode.visualState}
                </span>
              </div>
              <div>Label: {selectedNode.label}</div>
              <div>
                Propagation Step:{' '}
                {selectedNode.propagationStep === -1
                  ? 'Not in U (Verified Unaffected)'
                  : `U(${selectedNode.propagationStep})`}
              </div>
              <div className="text-muted-foreground">
                Why Included/Excluded: {selectedNode.inclusionReason}
              </div>
              <div>
                Evidence References: {selectedNode.evidenceRefs.join(', ')}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded bg-secondary/20 border border-border text-xs text-muted-foreground">
              Click any node in the interactive graph above (or in the node list below) to inspect its causal lineage and evidence references.
            </div>
          )}
        </div>

        {/* BFS Propagation Frontier Log */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            BFS Uncertainty Propagation Frontiers U(0) → U(k)
          </h3>
          {causalGraph.propagationIterations.length === 0 ? (
            <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-mono">
              U(0) = ∅ — Zero disagreements detected; no uncertainty propagation occurred.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {causalGraph.propagationIterations.map((iter) => (
                <div
                  key={iter.step}
                  className="p-2.5 rounded bg-secondary/40 border border-border text-xs font-mono"
                >
                  <span className="text-amber-400 font-bold">
                    Step U({iter.step}):
                  </span>{' '}
                  Added [{iter.addedNodes.join(', ')}]
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
