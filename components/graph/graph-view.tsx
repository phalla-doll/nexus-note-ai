"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import cytoscape, {
    type Core,
    type ElementDefinition,
    type StylesheetStyle,
} from "cytoscape"
import coseBilkent from "cytoscape-cose-bilkent"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    ConnectIcon,
    Refresh01Icon,
    Note01Icon,
} from "@hugeicons/core-free-icons"

import { loadGraph } from "@/app/actions/graph"
import type { GraphData } from "@/lib/graph/data"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

let layoutRegistered = false
function ensureLayout() {
    if (layoutRegistered) return
    cytoscape.use(coseBilkent)
    layoutRegistered = true
}

const STYLE: StylesheetStyle[] = [
    {
        selector: "node",
        style: {
            "background-color": "hsl(120 14% 60%)",
            label: "data(label)",
            color: "hsl(120 8% 35%)",
            "font-size": 10,
            "text-valign": "bottom",
            "text-margin-y": 4,
            "text-wrap": "ellipsis",
            "text-max-width": "120px",
            width: "mapData(weight, 0, 10, 14, 36)",
            height: "mapData(weight, 0, 10, 14, 36)",
            "border-width": 1,
            "border-color": "hsl(120 14% 45%)",
        },
    },
    {
        selector: "node:selected",
        style: {
            "background-color": "hsl(120 40% 45%)",
            "border-color": "hsl(120 40% 30%)",
            "border-width": 2,
            color: "hsl(120 40% 25%)",
        },
    },
    {
        selector: "node.hover-neighbor",
        style: {
            "background-color": "hsl(120 28% 55%)",
            "border-color": "hsl(120 28% 35%)",
        },
    },
    {
        selector: "edge",
        style: {
            width: 1.2,
            "line-color": "hsl(120 8% 70%)",
            "curve-style": "straight",
            opacity: 0.6,
        },
    },
    {
        selector: 'edge[type = "link"]',
        style: {
            "line-color": "hsl(120 40% 45%)",
            width: 1.8,
            opacity: 0.85,
        },
    },
    {
        selector: 'edge[type = "similarity"]',
        style: {
            "line-color": "hsl(120 10% 60%)",
            "line-style": "dashed",
            opacity: 0.45,
        },
    },
    {
        selector: "edge.hover-neighbor",
        style: {
            opacity: 1,
            width: 2.2,
        },
    },
]

function buildElements(
    data: GraphData,
    showSimilarity: boolean
): ElementDefinition[] {
    const elements: ElementDefinition[] = data.nodes.map((n) => ({
        data: {
            id: n.id,
            label: n.title,
            weight: Math.min(10, n.tag_count + n.link_count),
        },
    }))
    for (const e of data.edges) {
        if (e.type === "similarity" && !showSimilarity) continue
        elements.push({
            data: {
                id: `${e.source}->${e.target}:${e.type}`,
                source: e.source,
                target: e.target,
                type: e.type,
                score: e.score ?? 0,
            },
        })
    }
    return elements
}

export function GraphView() {
    const router = useRouter()
    const containerRef = useRef<HTMLDivElement | null>(null)
    const cyRef = useRef<Core | null>(null)
    const [data, setData] = useState<GraphData | null>(null)
    const [loading, setLoading] = useState(true)
    const [showSimilarity, setShowSimilarity] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const next = await loadGraph()
            setData(next)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap
        void load()
    }, [load])

    useEffect(() => {
        if (!data || !containerRef.current) return
        ensureLayout()

        const cy = cytoscape({
            container: containerRef.current,
            elements: buildElements(data, showSimilarity),
            style: STYLE,
            layout: {
                name: "cose-bilkent",
                animate: false,
                idealEdgeLength: 90,
                nodeRepulsion: 6000,
                fit: true,
                padding: 24,
            } as cytoscape.LayoutOptions,
            wheelSensitivity: 0.2,
            minZoom: 0.2,
            maxZoom: 3,
        })

        cy.on("tap", "node", (event) => {
            const node = event.target
            const id = node.id() as string
            router.push(`/notes/${id}`)
        })

        cy.on("mouseover", "node", (event) => {
            const node = event.target
            const neighborhood = node.neighborhood().add(node)
            cy.elements().not(neighborhood).style({ opacity: 0.15 })
            neighborhood.nodes().addClass("hover-neighbor")
            neighborhood.edges().addClass("hover-neighbor")
        })

        cy.on("mouseout", "node", () => {
            cy.elements().removeStyle("opacity")
            cy.elements().removeClass("hover-neighbor")
        })

        cyRef.current = cy
        return () => {
            cy.destroy()
            cyRef.current = null
        }
    }, [data, router, showSimilarity])

    if (loading) {
        return <Skeleton className="h-[calc(100svh-8rem)] w-full" />
    }

    if (error) {
        return (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
            </div>
        )
    }

    if (!data || data.nodes.length === 0) {
        return <EmptyState />
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <HugeiconsIcon icon={ConnectIcon} className="size-4" />
                    <span>
                        {data.nodes.length} notes ·{" "}
                        {data.edges.filter((e) => e.type === "link").length}{" "}
                        links ·{" "}
                        {
                            data.edges.filter((e) => e.type === "similarity")
                                .length
                        }{" "}
                        similarity
                    </span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="similarity-toggle"
                            checked={showSimilarity}
                            onCheckedChange={setShowSimilarity}
                        />
                        <Label
                            htmlFor="similarity-toggle"
                            className="text-xs text-muted-foreground"
                        >
                            Similarity edges
                        </Label>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={load}
                        className="h-7 gap-1 px-2 text-xs"
                    >
                        <HugeiconsIcon
                            icon={Refresh01Icon}
                            className="size-3.5"
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="h-[calc(100svh-9rem)] w-full rounded-md border bg-card"
            />

            <Legend />
        </div>
    )
}

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-6 rounded bg-[hsl(120_40%_45%)]" />
                Explicit link
            </span>
            <span className="flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-6 rounded border-t border-dashed border-[hsl(120_10%_60%)]" />
                Semantic similarity
            </span>
            <span className="ml-auto">
                Tap a node to open. Hover to highlight neighbors.
            </span>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-16 text-center text-muted-foreground">
            <HugeiconsIcon
                icon={Note01Icon}
                className="size-10"
                strokeWidth={1.5}
            />
            <p className="text-sm">
                No notes yet — write a few to see the graph.
            </p>
        </div>
    )
}
