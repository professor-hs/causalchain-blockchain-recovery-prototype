import {
  CausalEdge,
  CausalGraphResult,
  CausalNode,
  CheckpointRecord,
  DisagreementRecord,
  ExecutionEvidence,
  StorageEvidence,
} from '../../types';

/**
 * Build Causal Dependency Graph G = (N, E) and execute O(N + E) BFS Uncertainty Propagation:
 * U(k+1) = U(k) ∪ {v | there exists u in U(k) and a causal edge u -> v}
 */
export function buildCausalGraphAndPropagate(
  checkpoint: CheckpointRecord | null,
  executionEvidence: ExecutionEvidence[],
  storageEvidence: StorageEvidence[],
  disagreements: DisagreementRecord[]
): CausalGraphResult {
  const nodesMap = new Map<string, CausalNode>();
  const edges: CausalEdge[] = [];
  let edgeCounter = 1;

  if (checkpoint) {
    const ckptNodeId = `CKPT:${checkpoint.checkpointId}`;
    nodesMap.set(ckptNodeId, {
      id: ckptNodeId,
      label: `Checkpoint ${checkpoint.checkpointId} (Block #${checkpoint.blockNumber})`,
      nodeType: 'CHECKPOINT',
      visualState: checkpoint.authenticated ? 'VERIFIED_UNAFFECTED' : 'INCONSISTENT',
      propagationStep: -1,
      inclusionReason: `Authenticated baseline state checkpoint (${checkpoint.stateObjects.length} state objects).`,
      evidenceRefs: [checkpoint.checkpointId],
    });

    for (const s of checkpoint.stateObjects) {
      const stateNodeId = `STATE:${s.stateId}@v${s.stateVersion}`;
      nodesMap.set(stateNodeId, {
        id: stateNodeId,
        label: `${s.stateId} @ v${s.stateVersion}`,
        nodeType: 'STATE_OBJECT',
        visualState: 'VERIFIED_UNAFFECTED',
        stateObjectId: s.stateId,
        stateVersion: s.stateVersion,
        propagationStep: -1,
        inclusionReason: `Baseline state version v${s.stateVersion} anchored in checkpoint ${checkpoint.checkpointId}.`,
        evidenceRefs: [checkpoint.checkpointId],
      });

      edges.push({
        id: `EDGE-${edgeCounter++}`,
        source: ckptNodeId,
        target: stateNodeId,
        dependencyType: 'STATE_VERSION_LINEAGE',
        stateObjectId: s.stateId,
        propagatesUncertainty: true,
        explanation: `Checkpoint ${checkpoint.checkpointId} anchors initial version ${s.stateId}@v${s.stateVersion}.`,
      });
    }
  }

  const stateVersionProducer = new Map<string, string>();
  const latestStateNodeByKey = new Map<
    string,
    { nodeId: string; version: number; txId?: string }
  >();

  if (checkpoint) {
    for (const s of checkpoint.stateObjects) {
      const stateNodeId = `STATE:${s.stateId}@v${s.stateVersion}`;
      stateVersionProducer.set(`${s.stateId}@v${s.stateVersion}`, stateNodeId);
      latestStateNodeByKey.set(s.stateId, {
        nodeId: stateNodeId,
        version: s.stateVersion,
      });
    }
  }

  const sortedExec = [...executionEvidence].sort(
    (a, b) => a.executionSequence - b.executionSequence
  );

  for (const exec of sortedExec) {
    const txNodeId = `TX:${exec.transactionId}`;
    nodesMap.set(txNodeId, {
      id: txNodeId,
      label: `Tx ${exec.transactionId} (Seq #${exec.executionSequence})`,
      nodeType: 'TRANSACTION',
      visualState: 'MATCHED',
      transactionId: exec.transactionId,
      propagationStep: -1,
      inclusionReason: `Transaction ${exec.transactionId} executed at sequence #${exec.executionSequence}; unaffected by causal discrepancies.`,
      evidenceRefs: [exec.evidenceId],
    });

    for (const read of exec.stateObjectsRead) {
      const readKey = `${read.stateId}@v${read.versionRead}`;
      const producerNodeId = stateVersionProducer.get(readKey);

      if (producerNodeId) {
        edges.push({
          id: `EDGE-${edgeCounter++}`,
          source: producerNodeId,
          target: txNodeId,
          dependencyType: 'READ_AFTER_WRITE',
          stateObjectId: read.stateId,
          propagatesUncertainty: true,
          explanation: `Read-After-Write: ${exec.transactionId} reads ${readKey} produced by ${producerNodeId}.`,
        });
      } else {
        const unresolvedNodeId = `UNRESOLVED:${readKey}`;
        if (!nodesMap.has(unresolvedNodeId)) {
          nodesMap.set(unresolvedNodeId, {
            id: unresolvedNodeId,
            label: `Unresolved ${readKey}`,
            nodeType: 'UNCERTAIN_DEPENDENCY',
            visualState: 'UNRESOLVED',
            stateObjectId: read.stateId,
            stateVersion: read.versionRead,
            propagationStep: 0,
            inclusionReason: `State version ${readKey} read by ${exec.transactionId} has no verified producer in checkpoint or execution lineage.`,
            evidenceRefs: [exec.evidenceId],
          });
        }
        edges.push({
          id: `EDGE-${edgeCounter++}`,
          source: unresolvedNodeId,
          target: txNodeId,
          dependencyType: 'UNRESOLVED_DEPENDENCY',
          stateObjectId: read.stateId,
          propagatesUncertainty: true,
          explanation: `Unresolved Dependency: ${exec.transactionId} reads ${readKey} whose origin is missing.`,
        });
      }
    }

    for (const write of exec.stateObjectsWritten) {
      const stateNodeId = `STATE:${write.stateId}@v${write.resultingVersion}`;
      const prevStateNodeId = `STATE:${write.stateId}@v${write.previousVersion}`;

      nodesMap.set(stateNodeId, {
        id: stateNodeId,
        label: `${write.stateId} @ v${write.resultingVersion}`,
        nodeType: 'STATE_OBJECT',
        visualState: 'MATCHED',
        transactionId: exec.transactionId,
        stateObjectId: write.stateId,
        stateVersion: write.resultingVersion,
        propagationStep: -1,
        inclusionReason: `State version ${write.stateId}@v${write.resultingVersion} written by ${exec.transactionId}.`,
        evidenceRefs: [exec.evidenceId],
      });

      edges.push({
        id: `EDGE-${edgeCounter++}`,
        source: txNodeId,
        target: stateNodeId,
        dependencyType: 'WRITE_AFTER_WRITE',
        stateObjectId: write.stateId,
        propagatesUncertainty: true,
        explanation: `${exec.transactionId} writes ${write.stateId}@v${write.resultingVersion}.`,
      });

      if (nodesMap.has(prevStateNodeId)) {
        edges.push({
          id: `EDGE-${edgeCounter++}`,
          source: prevStateNodeId,
          target: txNodeId,
          dependencyType: 'STATE_VERSION_LINEAGE',
          stateObjectId: write.stateId,
          propagatesUncertainty: true,
          explanation: `State-Version Lineage: ${exec.transactionId} transitions ${write.stateId} from v${write.previousVersion} to v${write.resultingVersion}.`,
        });
      }

      const prevProducer = latestStateNodeByKey.get(write.stateId);
      if (prevProducer?.txId && prevProducer.txId !== exec.transactionId) {
        edges.push({
          id: `EDGE-${edgeCounter++}`,
          source: `TX:${prevProducer.txId}`,
          target: txNodeId,
          dependencyType: 'TRANSACTION_PREDECESSOR',
          stateObjectId: write.stateId,
          propagatesUncertainty: true,
          explanation: `Write-After-Write predecessor: ${exec.transactionId} overwrites ${write.stateId} after ${prevProducer.txId}.`,
        });
      }

      stateVersionProducer.set(`${write.stateId}@v${write.resultingVersion}`, stateNodeId);
      latestStateNodeByKey.set(write.stateId, {
        nodeId: stateNodeId,
        version: write.resultingVersion,
        txId: exec.transactionId,
      });
    }
  }

  const initialUncertainSet = new Set<string>();
  const unresolvedDependencyNodes = new Set<string>();

  for (const node of nodesMap.values()) {
    if (node.nodeType === 'UNCERTAIN_DEPENDENCY') {
      initialUncertainSet.add(node.id);
      unresolvedDependencyNodes.add(node.id);
    }
  }

  const storById = new Map(storageEvidence.map((s) => [s.evidenceId, s]));

  for (const dis of disagreements) {
    if (dis.indicator === '0') continue;

    const txNodeId = `TX:${dis.transactionId}`;
    if (!nodesMap.has(txNodeId)) {
      nodesMap.set(txNodeId, {
        id: txNodeId,
        label: `Unverified Tx ${dis.transactionId}`,
        nodeType: 'DISAGREEMENT',
        visualState: dis.indicator === '⊥' ? 'UNRESOLVED' : 'INCONSISTENT',
        transactionId: dis.transactionId,
        stateObjectId: dis.stateObjectId,
        propagationStep: 0,
        inclusionReason: `Direct ${dis.disagreementType} (${dis.subClassification}) on state ${dis.stateObjectId}: ${dis.detectionExplanation}`,
        evidenceRefs: dis.evidenceReferences,
      });
    } else {
      const existing = nodesMap.get(txNodeId)!;
      existing.nodeType = 'DISAGREEMENT';
      existing.visualState = dis.indicator === '⊥' ? 'UNRESOLVED' : 'INCONSISTENT';
      existing.propagationStep = 0;
      existing.inclusionReason = `Direct ${dis.disagreementType} (Δi = ${dis.indicator}) on ${dis.stateObjectId}: ${dis.detectionExplanation}`;
    }
    initialUncertainSet.add(txNodeId);
    if (dis.indicator === '⊥') {
      unresolvedDependencyNodes.add(txNodeId);
    }

    const ver = dis.expectedVersion ?? dis.observedVersion;
    if (ver !== undefined) {
      const stateNodeId = `STATE:${dis.stateObjectId}@v${ver}`;
      if (!nodesMap.has(stateNodeId)) {
        const storRec = dis.evidenceReferences
          .map((id) => storById.get(id))
          .find(Boolean);
        nodesMap.set(stateNodeId, {
          id: stateNodeId,
          label: `${dis.stateObjectId} @ v${ver} (Disputed)`,
          nodeType: 'DISAGREEMENT',
          visualState: dis.indicator === '⊥' ? 'UNRESOLVED' : 'INCONSISTENT',
          transactionId: dis.transactionId,
          stateObjectId: dis.stateObjectId,
          stateVersion: ver,
          propagationStep: 0,
          inclusionReason: `Disputed state version ${dis.stateObjectId}@v${ver} from ${dis.disagreementType}.`,
          evidenceRefs: storRec ? [storRec.evidenceId] : dis.evidenceReferences,
        });
        edges.push({
          id: `EDGE-${edgeCounter++}`,
          source: txNodeId,
          target: stateNodeId,
          dependencyType: 'WRITE_AFTER_WRITE',
          stateObjectId: dis.stateObjectId,
          propagatesUncertainty: true,
          explanation: `Disputed state write on ${dis.stateObjectId}@v${ver}.`,
        });
      } else {
        const stNode = nodesMap.get(stateNodeId)!;
        stNode.visualState = dis.indicator === '⊥' ? 'UNRESOLVED' : 'INCONSISTENT';
        stNode.propagationStep = 0;
        stNode.inclusionReason = `Directly affected state version ${dis.stateObjectId}@v${ver} due to ${dis.disagreementType} in ${dis.transactionId}.`;
      }
      initialUncertainSet.add(stateNodeId);
      if (dis.indicator === '⊥') {
        unresolvedDependencyNodes.add(stateNodeId);
      }
    }
  }

  // Build adjacency list for O(N + E) BFS traversal
  const outgoingBySource = new Map<string, CausalEdge[]>();
  for (const e of edges) {
    if (!e.propagatesUncertainty) continue;
    const list = outgoingBySource.get(e.source);
    if (list) list.push(e);
    else outgoingBySource.set(e.source, [e]);
  }

  const directlyInconsistentNodes = Array.from(initialUncertainSet);
  const visited = new Set<string>(initialUncertainSet);
  const transitivelyAffectedNodes: string[] = [];
  const propagationIterations: { step: number; addedNodes: string[] }[] = [];

  if (directlyInconsistentNodes.length > 0) {
    propagationIterations.push({
      step: 0,
      addedNodes: directlyInconsistentNodes,
    });
  }

  let frontier = [...directlyInconsistentNodes];
  let step = 1;

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];

    for (const u of frontier) {
      const uNode = nodesMap.get(u);
      const outgoing = outgoingBySource.get(u) || [];

      for (const edge of outgoing) {
        const v = edge.target;
        if (!visited.has(v)) {
          visited.add(v);
          nextFrontier.push(v);
          transitivelyAffectedNodes.push(v);

          const vNode = nodesMap.get(v);
          if (vNode) {
            vNode.propagationStep = step;
            const inheritedUnresolved = uNode?.visualState === 'UNRESOLVED';
            vNode.visualState = inheritedUnresolved
              ? 'UNRESOLVED'
              : 'POTENTIALLY_AFFECTED';
            if (inheritedUnresolved) {
              unresolvedDependencyNodes.add(v);
            }
            vNode.inclusionReason = `Included at propagation step U(${step}) via ${edge.dependencyType} from ${u} (${edge.explanation})`;
          }
        }
      }
    }

    if (nextFrontier.length > 0) {
      propagationIterations.push({
        step,
        addedNodes: nextFrontier,
      });
    }

    frontier = nextFrontier;
    step++;
  }

  const verifiedUnaffectedNodes: string[] = [];
  for (const node of nodesMap.values()) {
    if (!visited.has(node.id)) {
      node.visualState = 'VERIFIED_UNAFFECTED';
      if (node.nodeType === 'TRANSACTION') {
        node.nodeType = 'VERIFIED';
      }
      verifiedUnaffectedNodes.push(node.id);
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
    directlyInconsistentNodes,
    transitivelyAffectedNodes,
    unresolvedDependencyNodes: Array.from(unresolvedDependencyNodes),
    verifiedUnaffectedNodes,
    propagationIterations,
  };
}
