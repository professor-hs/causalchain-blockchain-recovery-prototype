import { AuditEventType, AuditLogEntry } from '../../types';
import { computeCanonicalCommitment } from '../cryptography';

export const GENESIS_AUDIT_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Append a new event to the hash-linked application audit chain.
 */
export async function appendAuditLogEntry(
  existingChain: AuditLogEntry[],
  params: {
    eventType: AuditEventType;
    relatedTransaction?: string;
    relatedEvidence?: string;
    summary: string;
  }
): Promise<AuditLogEntry> {
  const sequence = existingChain.length + 1;
  const previousAuditHash =
    existingChain.length > 0
      ? existingChain[existingChain.length - 1].currentAuditHash
      : GENESIS_AUDIT_HASH;
  const eventId = `AUD-${String(sequence).padStart(5, '0')}`;
  const timestamp = new Date().toISOString();

  const currentAuditHash = await computeCanonicalCommitment({
    eventId,
    sequence,
    timestamp,
    eventType: params.eventType,
    relatedTransaction: params.relatedTransaction ?? null,
    relatedEvidence: params.relatedEvidence ?? null,
    summary: params.summary,
    previousAuditHash,
  });

  return {
    eventId,
    sequence,
    timestamp,
    eventType: params.eventType,
    relatedTransaction: params.relatedTransaction,
    relatedEvidence: params.relatedEvidence,
    summary: params.summary,
    previousAuditHash,
    currentAuditHash,
  };
}

/**
 * Independently verify the hash-linked audit log chain from genesis.
 */
export async function verifyAuditChainIntegrity(chain: AuditLogEntry[]): Promise<{
  valid: boolean;
  verifiedCount: number;
  brokenAtSequence?: number;
  reason: string;
}> {
  let expectedPrevHash = GENESIS_AUDIT_HASH;

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    if (entry.previousAuditHash !== expectedPrevHash) {
      return {
        valid: false,
        verifiedCount: i,
        brokenAtSequence: entry.sequence,
        reason: `Broken previous-hash link at sequence #${entry.sequence} (${entry.eventId}). Expected ${expectedPrevHash.slice(0, 12)}..., found ${entry.previousAuditHash.slice(0, 12)}...`,
      };
    }

    const recomputed = await computeCanonicalCommitment({
      eventId: entry.eventId,
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      relatedTransaction: entry.relatedTransaction ?? null,
      relatedEvidence: entry.relatedEvidence ?? null,
      summary: entry.summary,
      previousAuditHash: entry.previousAuditHash,
    });

    if (recomputed !== entry.currentAuditHash) {
      return {
        valid: false,
        verifiedCount: i,
        brokenAtSequence: entry.sequence,
        reason: `Tampered payload detected at sequence #${entry.sequence} (${entry.eventId}). Recomputed hash ${recomputed.slice(0, 12)}... != recorded ${entry.currentAuditHash.slice(0, 12)}...`,
      };
    }

    expectedPrevHash = entry.currentAuditHash;
  }

  return {
    valid: true,
    verifiedCount: chain.length,
    reason: `All ${chain.length} hash-linked audit events verified from genesis.`,
  };
}
