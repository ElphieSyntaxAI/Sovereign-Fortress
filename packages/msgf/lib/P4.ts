/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getVertexGenerativeModel } from "@/lib/msgf-vertex";
import { runWithLlmTimeoutSimple } from '@/lib/services/cost-runaway-guard';

/** Raw keystroke from the frontend (send only what you need; avoid secrets). */
export interface KeystrokeEvent {
  ts: number;
  key: string;
  type?: 'keydown' | 'keyup' | 'input';
  /** Optional hint, e.g. field name, editor id, or `edu:ela` assignment tag */
  target?: string;
  /** Syntax Education "The Call" — key-down dwell $D_{down}$ (ms). */
  dwellMs?: number;
  /** Syntax Education "The Call" — inter-key flight $I_{flight}$ (ms). */
  flightMs?: number;
  isBackspace?: boolean;
  isSystemEvent?: boolean;
  wordsPasted?: number;
}

export type P4LedgerDomain = 'author' | 'education';

export interface ChunkOptions {
  /** Approximate trace “size” before flushing (default 800). */
  maxChars?: number;
  /** Max span from chunk start `ts` (default 4000 ms). */
  maxWindowMs?: number;
  /** Hard cap on events per chunk (default 120). */
  maxEvents?: number;
}

export interface KeystrokeChunk {
  index: number;
  events: KeystrokeEvent[];
  startedAt: number;
  endedAt: number;
  /** Line-oriented trace for Gemini (timing + keys). */
  traceText: string;
}

export interface StateBeatRow {
  id: string;
  /** DB column — human entity UUID (`entityId` in API). */
  author_id: string;
  tenant_id?: string | null;
  beat_text: string;
  /** Which Terms & Conditions version the user agreed to when this Pulse was recorded. */
  legal_version: string;
  sequence_index: number;
  label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface FlowVerifyResult {
  consistent: boolean;
  confidence: number;
  rationale: string;
}

function formatKeyToken(key: string): string {
  if (key.length === 1) return key;
  return `<${key}>`;
}

function rhythmSuffix(e: KeystrokeEvent): string {
  const parts: string[] = [];
  if (typeof e.dwellMs === 'number') parts.push(`dwell=${e.dwellMs}ms`);
  if (typeof e.flightMs === 'number') parts.push(`flight=${e.flightMs}ms`);
  if (e.isBackspace) parts.push('backspace');
  if (e.isSystemEvent) parts.push('system');
  if (typeof e.wordsPasted === 'number' && e.wordsPasted > 0) {
    parts.push(`pasteWords=${e.wordsPasted}`);
  }
  return parts.length ? ` {${parts.join(' ')}}` : '';
}

function keystrokeTrace(events: KeystrokeEvent[]): string {
  if (!events.length) return '';
  const t0 = events[0].ts;
  return events
    .map((e) => {
      const dt = e.ts - t0;
      const target = e.target ? ` [${e.target}]` : '';
      return `+${dt}ms\t${formatKeyToken(e.key)}${rhythmSuffix(e)}${target}`;
    })
    .join('\n');
}

function keyWeight(ev: KeystrokeEvent): number {
  return ev.key.length === 1 ? 1 : Math.min(ev.key.length, 24);
}

/**
 * Turn a raw keystroke stream into ordered chunks for P4 verification.
 */
export function chunkKeystrokeStream(
  raw: KeystrokeEvent[],
  opts: ChunkOptions = {}
): KeystrokeChunk[] {
  const maxChars = opts.maxChars ?? 800;
  const maxWindowMs = opts.maxWindowMs ?? 4000;
  const maxEvents = opts.maxEvents ?? 120;

  const sorted = [...raw].sort((a, b) => a.ts - b.ts);
  const chunks: KeystrokeChunk[] = [];
  const bucket: KeystrokeEvent[] = [];
  let windowStart = 0;
  let charCount = 0;

  const flush = () => {
    if (!bucket.length) return;
    const events = bucket.slice();
    chunks.push({
      index: chunks.length,
      events,
      startedAt: events[0].ts,
      endedAt: events[events.length - 1].ts,
      traceText: keystrokeTrace(events),
    });
    bucket.length = 0;
    charCount = 0;
  };

  for (const ev of sorted) {
    const w = keyWeight(ev);
    if (!bucket.length) {
      windowStart = ev.ts;
      charCount = 0;
    }

    const windowTooLong =
      bucket.length > 0 && ev.ts - windowStart > maxWindowMs;
    const tooManyChars =
      bucket.length > 0 && charCount + w > maxChars;
    const tooManyEvents = bucket.length >= maxEvents;

    if (bucket.length && (windowTooLong || tooManyChars || tooManyEvents)) {
      flush();
      windowStart = ev.ts;
      charCount = 0;
    }

    bucket.push(ev);
    charCount += w;
  }

  flush();
  return chunks;
}

function parseFlowVerifyResponse(text: string): FlowVerifyResult {
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : stripped;

  let parsed: Partial<FlowVerifyResult>;
  try {
    parsed = JSON.parse(jsonStr) as Partial<FlowVerifyResult>;
  } catch {
    return {
      consistent: true,
      confidence: 0,
      rationale: 'Unparseable model output; treating as inconclusive.',
    };
  }

  return {
    consistent: Boolean(parsed.consistent),
    confidence:
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0,
    rationale:
      typeof parsed.rationale === 'string'
        ? parsed.rationale
        : 'No rationale returned.',
  };
}

function buildFlowVerifyPrompt(
  domain: P4LedgerDomain,
  chunk: KeystrokeChunk,
  previousBeats: Pick<StateBeatRow, 'beat_text' | 'sequence_index'>[]
): string {
  const beatsContext = previousBeats.length
    ? previousBeats
        .map((b) => `[${b.sequence_index}] ${b.beat_text}`)
        .join('\n')
    : domain === 'education'
      ? '(no prior beats — first segment for this student assignment)'
      : '(no prior beats in ledger — first segment for this author)';

  if (domain === 'education') {
    return `You are MSGF P4 State Ledger for Syntax Education. Compare a student keystroke chunk (rhythm: dwell/flight, paste markers) to prior instructional "beats" (assignment milestones).

PREVIOUS BEATS (oldest → newest):
${beatsContext}

NEW STUDENT KEYSTROKE CHUNK (timing + keys + rhythm):
${chunk.traceText}

Decide if the student's typing flow is consistent with continuing the same assignment work implied by the beats. Inconsistency means abrupt subject change, off-task behavior, or implausible jump — not normal pauses, backspaces, or thinking time.

Reply with only valid JSON (no markdown):
{"consistent":true,"confidence":0.92,"rationale":"short reason"}`;
  }

  return `You are MSGF P4 State Ledger. Compare a new keystroke chunk to the author's stored "beats" (prior flow intent from Supabase).

PREVIOUS BEATS (oldest → newest):
${beatsContext}

NEW KEYSTROKE CHUNK (timing + keys):
${chunk.traceText}

Decide if the typing/editing flow is logically consistent with continuing the same work implied by the beats. Inconsistency means an abrupt topic change, contradictory intent, or implausible workflow — not ordinary typos, pauses, or backspaces.

Reply with only valid JSON (no markdown):
{"consistent":true,"confidence":0.92,"rationale":"short reason"}`;
}

async function verifyChunkAgainstBeats(
  chunk: KeystrokeChunk,
  previousBeats: Pick<StateBeatRow, 'beat_text' | 'sequence_index'>[],
  domain: P4LedgerDomain = 'author'
): Promise<FlowVerifyResult> {
  const model = getVertexGenerativeModel();

  const prompt = buildFlowVerifyPrompt(domain, chunk, previousBeats);

  const result = await runWithLlmTimeoutSimple('p4.verify_chunk_flow', () =>
    model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    })
  );

  const text =
    result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) {
    return {
      consistent: true,
      confidence: 0,
      rationale: 'Empty model response; inconclusive.',
    };
  }

  return parseFlowVerifyResponse(text);
}

/**
 * P4 State Ledger: Supabase-backed beats + Gemini 2.5 Flash flow checks.
 * Use a server-side Supabase client (user session or service role, per your RLS).
 */
export class StateLedgerP4 {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tenantId?: string,
    private readonly domain: P4LedgerDomain = 'author'
  ) {}

  async fetchPreviousBeats(
    entityId: string,
    limit = 32
  ): Promise<StateBeatRow[]> {
    let query = this.supabase
      .from('state_beats')
      .select(
        'id, author_id, tenant_id, beat_text, legal_version, sequence_index, label, metadata, created_at'
      )
      .eq('author_id', entityId.trim())
      .order('sequence_index', { ascending: true })
      .limit(limit);

    if (this.tenantId) {
      query = query.eq('tenant_id', this.tenantId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []) as StateBeatRow[];
  }

  /**
   * Chunk the stream, then verify each chunk against beats already in the ledger.
   */
  async verifyKeystrokeStream(
    entityId: string,
    events: KeystrokeEvent[],
    chunkOptions?: ChunkOptions
  ): Promise<{ chunks: KeystrokeChunk[]; results: FlowVerifyResult[] }> {
    const chunks = chunkKeystrokeStream(events, chunkOptions);
    const beats = await this.fetchPreviousBeats(entityId);
    const results: FlowVerifyResult[] = [];

    for (const chunk of chunks) {
      results.push(await verifyChunkAgainstBeats(chunk, beats, this.domain));
    }

    return { chunks, results };
  }

  /**
   * Persist a new beat after you accept a chunk (e.g. summary from the model or editor milestone).
   */
  async appendBeat(
    entityId: string,
    beatText: string,
    options: {
      label?: string;
      metadata?: Record<string, unknown>;
      /** Which Terms & Conditions version the user agreed to. */
      legalVersion: string;
    }
  ): Promise<StateBeatRow> {
    let maxQuery = this.supabase
      .from('state_beats')
      .select('sequence_index')
      .eq('author_id', entityId.trim())
      .order('sequence_index', { ascending: false })
      .limit(1);

    if (this.tenantId) {
      maxQuery = maxQuery.eq('tenant_id', this.tenantId);
    }

    const { data: maxRow, error: maxErr } = await maxQuery.maybeSingle();

    if (maxErr) throw maxErr;

    const nextSeq = (maxRow?.sequence_index ?? -1) + 1;

    const metadata = {
      ...(options?.metadata ?? {}),
      ...(this.tenantId ? { tenant_id: this.tenantId } : {}),
    };

    const { data, error } = await this.supabase
      .from('state_beats')
      .insert({
        author_id: entityId,
        tenant_id: this.tenantId ?? null,
        beat_text: beatText,
        legal_version: options.legalVersion,
        sequence_index: nextSeq,
        label: options?.label ?? null,
        metadata,
      })
      .select(
        'id, author_id, tenant_id, beat_text, legal_version, sequence_index, label, metadata, created_at'
      )
      .single();

    if (error) throw error;
    return data as StateBeatRow;
  }
}
