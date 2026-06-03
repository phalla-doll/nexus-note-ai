"use server"

import { getGraphData, type GraphData } from "@/lib/graph/data"

export async function loadGraph(): Promise<GraphData> {
    return getGraphData()
}
