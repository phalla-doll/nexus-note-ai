"use client"

import { useCallback, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon, Loading02Icon } from "@hugeicons/core-free-icons"

import { backfillNoteAi, type BackfillResult } from "@/app/actions/backfill"
import { Button } from "@/components/ui/button"

export function AiBackfillCard() {
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<BackfillResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleRun = useCallback(async () => {
        setRunning(true)
        setResult(null)
        setError(null)
        try {
            const next = await backfillNoteAi()
            setResult(next)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setRunning(false)
        }
    }, [])

    return (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
                <HugeiconsIcon
                    icon={SparklesIcon}
                    className="size-4 text-primary"
                />
                <h2 className="font-medium">AI backfill</h2>
            </div>
            <p className="text-sm text-muted-foreground">
                Embed and summarize notes that haven&apos;t been processed yet.
                Safe to run at any time — already-processed notes are skipped.
            </p>
            <div className="flex items-center gap-3">
                <Button onClick={handleRun} disabled={running} size="sm">
                    {running ? (
                        <>
                            <HugeiconsIcon
                                icon={Loading02Icon}
                                className="animate-spin"
                            />
                            Running…
                        </>
                    ) : (
                        <>
                            <HugeiconsIcon icon={SparklesIcon} />
                            Run backfill
                        </>
                    )}
                </Button>
                {result && (
                    <p className="text-xs text-muted-foreground">
                        Found {result.candidates}, processed {result.succeeded}
                        {result.failed > 0 ? `, ${result.failed} failed` : ""}.
                    </p>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
        </div>
    )
}
