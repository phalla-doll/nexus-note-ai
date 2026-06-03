import { PageShell } from "@/components/app/page-shell"
import { GraphView } from "@/components/graph/graph-view"

export default function GraphPage() {
    return (
        <PageShell
            title="Graph"
            description="Explicit links and semantic neighbors across your notes."
            className="max-w-none"
        >
            <GraphView />
        </PageShell>
    )
}
