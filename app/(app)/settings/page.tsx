import { PageShell } from "@/components/app/page-shell"
import { AiBackfillCard } from "@/components/settings/ai-backfill"

export default function SettingsPage() {
    return (
        <PageShell
            title="Settings"
            description="Theme, AI providers, and storage."
        >
            <AiBackfillCard />
        </PageShell>
    )
}
