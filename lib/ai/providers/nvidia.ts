import OpenAI from "openai"

// OpenAI-compatible client pointed at NVIDIA Build.
// Server-only — never import from a client component.
// Reads `NVIDIA_API_KEY` from the env. Configure it in `.env.local`.

const BASE_URL = "https://integrate.api.nvidia.com/v1"

let cached: OpenAI | null = null

export function getNvidiaClient(): OpenAI {
    if (cached) return cached
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
        throw new Error(
            "NVIDIA_API_KEY is not set. Add it to .env.local before calling the AI provider."
        )
    }
    cached = new OpenAI({ apiKey, baseURL: BASE_URL })
    return cached
}

export const NVIDIA_MODELS = {
    chat: "meta/llama-3.3-70b-instruct",
    coding: "openai/gpt-oss-120b",
    embed: "nvidia/nv-embedqa-e5-v5", // 1024-dim retrieval embeddings
    summary: "meta/llama-3.3-70b-instruct",
} as const

export type NvidiaModel = (typeof NVIDIA_MODELS)[keyof typeof NVIDIA_MODELS]

export const EMBEDDING_DIM = 1024
