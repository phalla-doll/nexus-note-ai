export const SUMMARY_SYSTEM_PROMPT = `You write one-sentence summaries of personal notes. Return only the summary text — no preamble, no quotes, no markdown. Max 200 characters. If the note is too short to summarize meaningfully, return its first sentence verbatim.`

export function summaryUserPrompt(title: string, content: string): string {
    const safeContent = content.slice(0, 4000)
    return `Title: ${title || "Untitled"}\n\nContent:\n${safeContent}`
}
