import {
  MerkleInclusionProof,
  MerkleProofStep,
  MerkleTreeData,
  StateObjectRecord,
  CheckpointRecord,
  ExecutionEvidence,
  StorageEvidence,
} from '../../types';

/**
 * Deterministic canonical JSON serialization:
 * Recursively sorts object keys alphabetically and removes undefined values.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalJson(item)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const entries = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + entries.join(',') + '}';
}

/**
 * Compute SHA-256 hex digest using Web Crypto API (crypto.subtle)
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is required for SHA-256 commitment generation');
  }
  const hashBuffer = await subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 commitment over canonical JSON representation of an object
 */
export async function computeCanonicalCommitment(payload: unknown): Promise<string> {
  const serialized = canonicalJson(payload);
  return sha256Hex(serialized);
}

/**
 * Compute individual state object integrity hash
 */
export async function computeStateObjectHash(
  state: Omit<StateObjectRecord, 'integrityHash'>
): Promise<string> {
  return computeCanonicalCommitment({
    stateId: state.stateId,
    currentValue: state.currentValue,
    stateVersion: state.stateVersion,
    lastTransaction: state.lastTransaction,
  });
}

/**
 * Compute checkpoint commitment over its canonical payload
 */
export async function computeCheckpointCommitment(
  checkpoint: Omit<CheckpointRecord, 'checkpointCommitment'>
): Promise<string> {
  const canonicalStates = [...checkpoint.stateObjects]
    .sort((a, b) => a.stateId.localeCompare(b.stateId))
    .map((s) => ({
      stateId: s.stateId,
      currentValue: s.currentValue,
      stateVersion: s.stateVersion,
      lastTransaction: s.lastTransaction,
      integrityHash: s.integrityHash,
    }));
  return computeCanonicalCommitment({
    checkpointId: checkpoint.checkpointId,
    blockNumber: checkpoint.blockNumber,
    stateObjects: canonicalStates,
  });
}

/**
 * Compute execution evidence record hash (excluding evidenceHash field itself)
 */
export async function computeExecutionEvidenceHash(
  record: Omit<ExecutionEvidence, 'evidenceHash'>
): Promise<string> {
  return computeCanonicalCommitment({
    evidenceId: record.evidenceId,
    transactionId: record.transactionId,
    blockNumber: record.blockNumber,
    executionSequence: record.executionSequence,
    contractAddress: record.contractAddress,
    stateObjectsRead: record.stateObjectsRead,
    stateObjectsWritten: record.stateObjectsWritten,
    previousStateVersion: record.previousStateVersion,
    resultingStateVersion: record.resultingStateVersion,
    executionStatus: record.executionStatus,
    evidenceSource: record.evidenceSource,
    authenticationStatus: record.authenticationStatus,
  });
}

/**
 * Compute storage evidence record hash (excluding evidenceHash field itself)
 */
export async function computeStorageEvidenceHash(
  record: Omit<StorageEvidence, 'evidenceHash'>
): Promise<string> {
  return computeCanonicalCommitment({
    evidenceId: record.evidenceId,
    transactionId: record.transactionId,
    affectedStateObject: record.affectedStateObject,
    storageOrdering: record.storageOrdering,
    previousVersion: record.previousVersion,
    stateVersion: record.stateVersion,
    writtenValue: record.writtenValue,
    operationType: record.operationType,
    commitStatus: record.commitStatus,
    authenticationStatus: record.authenticationStatus,
    evidenceSource: record.evidenceSource,
  });
}

/**
 * Merkle Tree construction with domain-separated leaf and internal node hashing.
 */
export async function buildMerkleTree(
  items: { label: string; canonicalPayload: unknown }[]
): Promise<MerkleTreeData> {
  if (items.length === 0) {
    const emptyRoot = await sha256Hex('MERKLE_EMPTY_TREE');
    return {
      root: emptyRoot,
      leaves: [],
      layers: [[emptyRoot]],
      proofs: {},
    };
  }

  // Sort items deterministically by label
  const sortedItems = [...items].sort((a, b) => a.label.localeCompare(b.label));

  const leaves: { label: string; valueHash: string }[] = [];
  for (const item of sortedItems) {
    const leafHash = await sha256Hex(`LEAF:${item.label}:${canonicalJson(item.canonicalPayload)}`);
    leaves.push({ label: item.label, valueHash: leafHash });
  }

  const layers: string[][] = [leaves.map((l) => l.valueHash)];
  let currentLayer = layers[0];

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
      const parentHash = await sha256Hex(`NODE:${left}:${right}`);
      nextLayer.push(parentHash);
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = layers[layers.length - 1][0];
  const proofs: Record<string, MerkleInclusionProof> = {};

  for (let leafIdx = 0; leafIdx < leaves.length; leafIdx++) {
    const leaf = leaves[leafIdx];
    const steps: MerkleProofStep[] = [];
    let idx = leafIdx;

    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const layer = layers[layerIdx];
      const isRightNode = idx % 2 === 1;
      const siblingIdx = isRightNode ? idx - 1 : idx + 1 < layer.length ? idx + 1 : idx;
      steps.push({
        position: isRightNode ? 'left' : 'right',
        hash: layer[siblingIdx],
      });
      idx = Math.floor(idx / 2);
    }

    proofs[leaf.label] = {
      leafLabel: leaf.label,
      leafHash: leaf.valueHash,
      rootHash: root,
      steps,
    };
  }

  return {
    root,
    leaves,
    layers,
    proofs,
  };
}

/**
 * Verify a Merkle inclusion proof independently
 */
export async function verifyMerkleInclusionProof(
  proof: MerkleInclusionProof,
  expectedRoot: string
): Promise<boolean> {
  if (!proof || !proof.leafHash || !expectedRoot) return false;
  let computedHash = proof.leafHash;
  for (const step of proof.steps) {
    if (step.position === 'left') {
      computedHash = await sha256Hex(`NODE:${step.hash}:${computedHash}`);
    } else {
      computedHash = await sha256Hex(`NODE:${computedHash}:${step.hash}`);
    }
  }
  return computedHash === expectedRoot && proof.rootHash === expectedRoot;
}

/**
 * Web Crypto ECDSA P-256 demo signature generation and verification
 * Explicitly documented as a locally generated demo keypair, not a mainnet validator key.
 */
export async function generateDemoKeyPair(): Promise<{
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}> {
  const subtle = globalThis.crypto.subtle;
  const keyPair = await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  return {
    publicKeyJwk,
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

export async function signCommitmentWithDemoKey(
  commitmentHex: string,
  privateKey: CryptoKey
): Promise<string> {
  const subtle = globalThis.crypto.subtle;
  const encoder = new TextEncoder();
  const data = encoder.encode(commitmentHex);
  const signatureBuffer = await subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    data
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyDemoSignature(
  commitmentHex: string,
  signatureHex: string,
  publicKeyJwk: JsonWebKey
): Promise<boolean> {
  try {
    const subtle = globalThis.crypto.subtle;
    const publicKey = await subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );
    const sigBytes = new Uint8Array(
      (signatureHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
    );
    const data = new TextEncoder().encode(commitmentHex);
    return await subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      sigBytes,
      data
    );
  } catch {
    return false;
  }
}
