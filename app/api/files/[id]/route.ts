import { repo } from "@/lib/db"
import { getPresignedGetUrl } from "@/lib/storage/r2"

export const runtime = "nodejs"

// GET /api/files/[id]
// Looks up the file metadata and 302-redirects to a short-lived presigned
// R2 GET URL. Cheap, keeps bytes off our server, and the URL expires.
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const file = await repo.files.get(id)
    if (!file || !file.r2_key) {
        return new Response("Not found", { status: 404 })
    }
    const url = await getPresignedGetUrl(file.r2_key)
    return Response.redirect(url, 302)
}
