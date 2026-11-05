# CAUSALCHAIN — Evidence-Driven Blockchain State Recovery & Verification Platform

**Invention Implementation:**
> *System and Method for Evidence-Disagreement-Driven Causal Boundary Certification and Cryptographically Verified State Reconstruction in Distributed Ledger Networks*

---

## 1. Overview

**CAUSALCHAIN** is a research prototype demonstrating the complete 12-stage technical workflow for detecting execution-vs-storage evidence disagreements, propagating causal uncertainty across transaction dependency graphs, certifying minimal causal boundaries, selectively reconstructing affected state from authenticated checkpoints while preserving unaffected state, and verifying recovery certificates across independent validator routines.

### Core Capabilities

1. **Execution Evidence Acquisition**: Structured tuples $E_i = (T_i, O_i, R_i, W_i, V_i, S_i, A_i)$ with SHA-256 integrity hashing.
2. **Storage-Operation Evidence Acquisition**: Separate, independent stream $D_j = (T_j, K_j, O_j, V_j, C_j, A_j)$ supporting `REQUESTED`, `ACKNOWLEDGED`, `PERSISTED`, `COMMITTED`, `FAILED`, and `UNKNOWN` commit states.
3. **Evidence Normalization & Correlation**: Classifies pairs into `MATCHED`, `EXECUTION_WITHOUT_STORAGE`, `STORAGE_WITHOUT_EXECUTION`, `ORDERING_MISMATCH`, `VERSION_CONFLICT`, `COMMIT_STATUS_CONFLICT`, and `UNRESOLVED_CORRELATION`.
4. **Evidence Disagreement Detection**: Evaluates $M_i = \text{Consistent}(X_i, D_i)$ and $\Delta_i \in \{0, 1, \perp\}$, distinguishing confirmed disagreements from missing, unavailable, or indeterminate evidence.
5. **Rule-Based Evidence Completeness Assessment**: Evaluates 10 explicit protocol rules (`SUFFICIENT`, `CONDITIONALLY_SUFFICIENT`, `INSUFFICIENT`). A high descriptive coverage percentage never overrides a failed mandatory requirement.
6. **Causal Uncertainty Propagation**: Constructs graph $G = (N, E)$ across Read-After-Write (`RAW`), Write-After-Write (`WAW`), and State-Version Lineage edges, running iterative BFS propagation $U(k+1) = U(k) \cup \{v \mid \exists u \in U(k) \land (u \to v) \in E\}$.
7. **Causal Boundary Certification**: Produces $B = (S_B, T_B, E_B, C_B, U_B)$ with outcomes `CERTIFIED`, `PROVISIONAL`, or `REJECTED`.
8. **Selective State Reconstruction**: Computes $S_B' = \text{Apply}(S_C, T_{Bv})$ strictly for certified boundaries while verifying preservation of all state outside $S_B$.
9. **Cryptographic Commitment Engine**: Web Crypto SHA-256 over canonical JSON, Merkle tree construction, and inclusion proof generation/verification.
10. **Cryptographic Recovery Certificate Generator**: Canonical recovery certificate with Web Crypto ECDSA P-256 demo signatures and tampering simulation.
11. **Independent Validator Verification**: Three independent demo validator engines (`VAL-ALPHA-01`, `VAL-BETA-02`, `VAL-GAMMA-03`) independently recomputing hashes, commitments, and Merkle proofs.
12. **Protocol-Compliant State Acceptance Controller**: Enforces all 7 protocol invariants before marking recovery `ACCEPTED`, `SUSPENDED`, or `REJECTED`.

---

## 2. Public Ethereum JSON-RPC Integration & Provenance Distinction

Default keyless public RPC endpoints:
- **Ethereum Mainnet**: `https://ethereum-rpc.publicnode.com`
- **Ethereum Sepolia**: `https://ethereum-sepolia-rpc.publicnode.com`

**Provenance Distinction**:
- Block headers, transaction envelopes, receipts, event logs, and top-level account queries (`eth_getBalance`, `eth_getCode`, `eth_getStorageAt`) are retrieved live from public RPC endpoints.
- Because public JSON-RPC does not expose internal EVM read/write version sets or independent storage-engine commit logs, imported live transactions label internal version transitions as `LIVE_RPC_INFERRED` and mark storage commit logs as `UNAVAILABLE` rather than fabricating storage records.

---

## 3. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Run unit & integration test suite (Vitest)
npm test

# 4. Build production bundle
npm run build
```

---

## 4. Running Experiments & Benchmarks

1. Open the application and click **Run Complete Patent Workflow** in the top navigation bar for a guided 14-stage execution walkthrough.
2. Navigate to **Experiments & Benchmarks** (Module 13) to run any of the 8 predefined scenarios (**Scenarios A–H**) or execute synthetic workload benchmarks across **100, 500, 1,000, 5,000, and 10,000 transactions**.
