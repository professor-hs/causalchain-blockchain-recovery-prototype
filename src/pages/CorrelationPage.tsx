import React, { useState } from 'react';
import { GitCompare, Search } from 'lucide-react';
import { useCausalChain } from '../hooks/useCausalChainStore';
import { CorrelationCategory } from '../types';

const ALL_CATEGORIES: CorrelationCategory[] = [
  'MATCHED',
  'EXECUTION_WITHOUT_STORAGE',
  'STORAGE_WITHOUT_EXECUTION',
  'ORDERING_MISMATCH',
  'VERSION_CONFLICT',
  'COMMIT_STATUS_CONFLICT',
  'UNRESOLVED_CORRELATION',
];

export const CorrelationPage: React.FC = () => {
  const { workflowOutput } = useCausalChain();
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!workflowOutput) return null;
  const { correlations } = workflowOutput;

  const filtered = correlations.filter((c) => {
    const matchesCat = categoryFilter === 'ALL' || c.category === categoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      c.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.stateObjectId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.explanation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const badgeStyle = (cat: CorrelationCategory) => {
    switch (cat) {
      case 'MATCHED':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'VERSION_CONFLICT':
      case 'STORAGE_WITHOUT_EXECUTION':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold">
            Evidence Normalization & Correlation Engine (Module 11)
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Normalizes and correlates Execution Evidence (<code className="font-mono">Ei</code>)
          and Storage-Operation Evidence (<code className="font-mono">Dj</code>) across
          transaction IDs, state object keys, execution/storage ordering, version lineage, and commit status.
        </p>

        {/* Category Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-3">
          {ALL_CATEGORIES.map((cat) => {
            const count = correlations.filter((c) => c.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() =>
                  setCategoryFilter(categoryFilter === cat ? 'ALL' : cat)
                }
                className={`p-2.5 rounded border text-left transition-colors ${
                  categoryFilter === cat
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-secondary/40 border-border hover:bg-accent'
                }`}
              >
                <div className="text-sm font-bold font-mono">{count}</div>
                <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                  {cat}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by transaction ID, state object (KA, KB...), or explanation..."
            className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-xs font-mono"
        >
          <option value="ALL">All 7 Correlation Categories</option>
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Detailed Correlation Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-mono text-muted-foreground uppercase">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Tx ID</th>
                <th className="py-3 px-4">State Object</th>
                <th className="py-3 px-4">Exec Ref / Order</th>
                <th className="py-3 px-4">Storage Ref / Order</th>
                <th className="py-3 px-4">Expected vs Observed Ver</th>
                <th className="py-3 px-4">Commit Status</th>
                <th className="py-3 px-4">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <React.Fragment key={row.correlationId}>
                  <tr className="hover:bg-secondary/30">
                    <td className="py-3 px-4 font-mono text-blue-400">
                      {row.correlationId}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      {row.transactionId}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {row.stateObjectId}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {row.executionEvidenceId ? (
                        <span>
                          {row.executionEvidenceId} (#{row.executionOrdering})
                        </span>
                      ) : (
                        <span className="text-rose-400">MISSING</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {row.storageEvidenceId ? (
                        <span>
                          {row.storageEvidenceId} (#{row.storageOrdering})
                        </span>
                      ) : (
                        <span className="text-rose-400">MISSING</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      v{row.expectedVersion ?? '—'} vs v
                      {row.observedStorageVersion ?? '—'}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {row.commitStatus ?? 'UNAVAILABLE'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded border font-mono text-[10px] font-semibold ${badgeStyle(
                          row.category
                        )}`}
                      >
                        {row.category}
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-secondary/10">
                    <td
                      colSpan={8}
                      className="py-2 px-4 text-[11px] text-muted-foreground font-mono"
                    >
                      ↳ {row.explanation}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
