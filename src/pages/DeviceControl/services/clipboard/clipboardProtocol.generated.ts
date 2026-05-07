/**
 * clipboard wire protocol: set / refused / capabilities envelopes for v1.3 mutual clipboard.
 */
export interface ClipboardProtocolGenerated {
    capabilitiesEnvelope?: ClipboardCapabilitiesEnvelope;
    chunkEnvelope?:        ClipboardChunkEnvelope;
    refusalReason?:        ClipboardRefusalReason;
    refusedEnvelope?:      ClipboardRefusedEnvelope;
    setEnvelope?:          ClipboardSetEnvelope;
}

/**
 * Sent on every channel-open and on every settings change. Receiver caches latest as policy.
 */
export interface ClipboardCapabilitiesEnvelope {
    inboundEnabled: boolean;
    kind:           CapabilitiesEnvelopeKind;
    /**
     * Server-advertised cap; v1.3 = 2000000.
     */
    maxBytes:        number;
    originId:        string;
    outboundEnabled: boolean;
    /**
     * Semantic protocol marker, e.g. "1.0".
     */
    protocolVersion: string;
    seq:             number;
    ts:              number;
}

export type CapabilitiesEnvelopeKind = "capabilities";

/**
 * Chunk metadata envelope for chunked-fallback transport mode.
 */
export interface ClipboardChunkEnvelope {
    chunkOf:  number;
    chunkSeq: number;
    kind:     ChunkEnvelopeKind;
    originId: string;
    /**
     * Hex-encoded binary chunk payload for JSON-channel spike compatibility.
     */
    payloadHex: string;
    seq:        number;
    transferId: string;
    ts:         number;
}

export type ChunkEnvelopeKind = "chunk";

/**
 * Categorized refusal reason. Stable; new entries added rather than repurposed. Locked by
 * CONTEXT D-03.
 */
export type ClipboardRefusalReason =
    | "TOO_LARGE"
    | "INBOUND_DISABLED"
    | "MASTER_DISABLED"
    | "PAUSED"
    | "NON_TEXT";

/**
 * Refusal in response to a `set` we cannot apply.
 */
export interface ClipboardRefusedEnvelope {
    kind: RefusedEnvelopeKind;
    /**
     * Echo of the offending envelope's originId for correlation.
     */
    originId: string;
    reason:   ClipboardRefusalReason;
    seq:      number;
    ts:       number;
}

export type RefusedEnvelopeKind = "refused";

/**
 * Apply this text to the receiver's clipboard (subject to receiver-side loop and policy
 * gates).
 */
export interface ClipboardSetEnvelope {
    /**
     * Total chunk count (chunked transfers only).
     */
    chunkOf?: number;
    /**
     * 0-indexed chunk sequence (chunked transfers only).
     */
    chunkSeq?: number;
    /**
     * UTF-8 text payload. <= 2_000_000 UTF-8 bytes pre-hash (TRANSPORT-02).
     */
    content: string;
    /**
     * SHA-256 of UTF-8 content bytes, first 8 bytes, lowercase hex (LOOP-02).
     */
    contentHash: string;
    kind:        SetEnvelopeKind;
    /**
     * Sender per-channel-open UUID v4. Receiver MUST drop on self-match.
     */
    originId: string;
    /**
     * Monotonic per-origin counter. Diagnostic only (D-04).
     */
    seq: number;
    /**
     * Sender wall-clock epoch ms. Diagnostic only (D-04).
     */
    ts: number;
}

export type SetEnvelopeKind = "set";
