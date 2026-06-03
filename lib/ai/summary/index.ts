import "server-only"

import { NVIDIA_MODELS, getNvidiaClient } from "@/lib/ai/providers/nvidia"
import {
    SUMMARY_SYSTEM_PROMPT,
    summaryUserPrompt,
} from "@/lib/ai/prompts/summary"

export async function summarizeNote(
    title: string,
    content: string
): Promise<string> {
    if (!content.trim()) return ""
    const client = getNvidiaClient()
    const res = await client.chat.completions.create({
        model: NVIDIA_MODELS.summary,
        temperature: 0.3,
        top_p: 1,
        max_tokens: 120,
        stream: false,
        messages: [
            { role: "system", content: SUMMARY_SYSTEM_PROMPT },
            { role: "user", content: summaryUserPrompt(title, content) },
        ],
    })
    const text = res.choices[0]?.message?.content ?? ""
    return text.replace(/\s+/g, " ").trim().slice(0, 240)
}
