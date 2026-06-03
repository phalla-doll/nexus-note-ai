import "server-only"

import {
    EMBEDDING_DIM,
    NVIDIA_MODELS,
    getNvidiaClient,
} from "@/lib/ai/providers/nvidia"

// Embeddings via NVIDIA Build (OpenAI-compatible /v1/embeddings).
// `input_type` is an NVIDIA-specific extra param ("query" | "passage") used
// to disambiguate retrieval-side vs index-side encoding. The default OpenAI
// SDK lets us pass extras through `body` typed-as-any.

const MAX_INPUT_CHARS = 8000

export async function embedPassage(text: string): Promise<number[]> {
    return embed(text, "passage")
}

export async function embedQuery(text: string): Promise<number[]> {
    return embed(text, "query")
}

async function embed(
    text: string,
    inputType: "query" | "passage"
): Promise<number[]> {
    const trimmed = text.trim().slice(0, MAX_INPUT_CHARS)
    if (!trimmed) {
        // Match the model's output shape so callers don't branch.
        return new Array(EMBEDDING_DIM).fill(0)
    }
    const client = getNvidiaClient()
    const res = await client.embeddings.create({
        model: NVIDIA_MODELS.embed,
        input: trimmed,
        // NVIDIA-specific: passage for stored docs, query for user queries.
        // The SDK forwards unknown body fields when the API allows extras.
        ...({ input_type: inputType, truncate: "END" } as Record<
            string,
            string
        >),
    })
    return res.data[0].embedding
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
