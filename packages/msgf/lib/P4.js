"use strict";
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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateLedgerP4 = void 0;
exports.chunkKeystrokeStream = chunkKeystrokeStream;
const msgf_vertex_1 = require("./msgf-vertex");
function formatKeyToken(key) {
    if (key.length === 1)
        return key;
    return `<${key}>`;
}
function keystrokeTrace(events) {
    if (!events.length)
        return '';
    const t0 = events[0].ts;
    return events
        .map((e) => {
        const dt = e.ts - t0;
        const target = e.target ? ` [${e.target}]` : '';
        return `+${dt}ms\t${formatKeyToken(e.key)}${target}`;
    })
        .join('\n');
}
function keyWeight(ev) {
    return ev.key.length === 1 ? 1 : Math.min(ev.key.length, 24);
}
/**
 * Turn a raw keystroke stream into ordered chunks for P4 verification.
 */
function chunkKeystrokeStream(raw, opts = {}) {
    const maxChars = opts.maxChars ?? 800;
    const maxWindowMs = opts.maxWindowMs ?? 4000;
    const maxEvents = opts.maxEvents ?? 120;
    const sorted = [...raw].sort((a, b) => a.ts - b.ts);
    const chunks = [];
    const bucket = [];
    let windowStart = 0;
    let charCount = 0;
    const flush = () => {
        if (!bucket.length)
            return;
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
        const windowTooLong = bucket.length > 0 && ev.ts - windowStart > maxWindowMs;
        const tooManyChars = bucket.length > 0 && charCount + w > maxChars;
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
function parseFlowVerifyResponse(text) {
    const stripped = text
        .replace(/```json\s*/gi, '')
        .replace(/```/g, '')
        .trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : stripped;
    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    }
    catch {
        return {
            consistent: true,
            confidence: 0,
            rationale: 'Unparseable model output; treating as inconclusive.',
        };
    }
    return {
        consistent: Boolean(parsed.consistent),
        confidence: typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0,
        rationale: typeof parsed.rationale === 'string'
            ? parsed.rationale
            : 'No rationale returned.',
    };
}
async function verifyChunkAgainstBeats(chunk, previousBeats) {
    const model = (0, msgf_vertex_1.getVertexGenerativeModel)();
    const beatsContext = previousBeats.length
        ? previousBeats
            .map((b) => `[${b.sequence_index}] ${b.beat_text}`)
            .join('\n')
        : '(no prior beats in ledger — first segment for this author)';
    const prompt = `You are MSGF P4 State Ledger. Compare a new keystroke chunk to the author's stored "beats" (prior flow intent from Supabase).

PREVIOUS BEATS (oldest → newest):
${beatsContext}

NEW KEYSTROKE CHUNK (timing + keys):
${chunk.traceText}

Decide if the typing/editing flow is logically consistent with continuing the same work implied by the beats. Inconsistency means an abrupt topic change, contradictory intent, or implausible workflow — not ordinary typos, pauses, or backspaces.

Reply with only valid JSON (no markdown):
{"consistent":true,"confidence":0.92,"rationale":"short reason"}`;
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
        },
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
class StateLedgerP4 {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async fetchPreviousBeats(authorId, limit = 32) {
        const { data, error } = await this.supabase
            .from('state_beats')
            .select('id, author_id, beat_text, legal_version, sequence_index, label, metadata, created_at')
            .eq('author_id', authorId)
            .order('sequence_index', { ascending: true })
            .limit(limit);
        if (error)
            throw error;
        return (data ?? []);
    }
    /**
     * Chunk the stream, then verify each chunk against beats already in the ledger.
     */
    async verifyKeystrokeStream(authorId, events, chunkOptions) {
        const chunks = chunkKeystrokeStream(events, chunkOptions);
        const beats = await this.fetchPreviousBeats(authorId);
        const results = [];
        for (const chunk of chunks) {
            results.push(await verifyChunkAgainstBeats(chunk, beats));
        }
        return { chunks, results };
    }
    /**
     * Persist a new beat after you accept a chunk (e.g. summary from the model or editor milestone).
     */
    async appendBeat(authorId, beatText, options) {
        const { data: maxRow, error: maxErr } = await this.supabase
            .from('state_beats')
            .select('sequence_index')
            .eq('author_id', authorId)
            .order('sequence_index', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (maxErr)
            throw maxErr;
        const nextSeq = (maxRow?.sequence_index ?? -1) + 1;
        const { data, error } = await this.supabase
            .from('state_beats')
            .insert({
            author_id: authorId,
            beat_text: beatText,
            legal_version: options.legalVersion,
            sequence_index: nextSeq,
            label: options?.label ?? null,
            metadata: options?.metadata ?? {},
        })
            .select('id, author_id, beat_text, legal_version, sequence_index, label, metadata, created_at')
            .single();
        if (error)
            throw error;
        return data;
    }
}
exports.StateLedgerP4 = StateLedgerP4;
