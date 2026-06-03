import { PageShell } from "@/components/app/page-shell"
import { SearchPageClient } from "@/components/search/search-page"

export default function SearchPage() {
    return (
        <PageShell
            title="Search"
            description="Full-text across titles and content. Hybrid retrieval lands in Phase 2."
        >
            <SearchPageClient />
        </PageShell>
    )
}
