import { repo } from "@/lib/db"
import { buildR2Key, putObject } from "@/lib/storage/r2"

export const runtime = "nodejs"

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

// POST /api/files
// Multipart body: file (File), noteId? (string)
// Returns the persisted FileRecord.
export async function POST(request: Request) {
    let form: FormData
    try {
        form = await request.formData()
    } catch {
        return Response.json(
            { error: "Expected multipart/form-data" },
            { status: 400 }
        )
    }

    const file = form.get("file")
    const noteIdRaw = form.get("noteId")
    if (!(file instanceof File)) {
        return Response.json({ error: "Missing file" }, { status: 400 })
    }
    if (file.size === 0) {
        return Response.json({ error: "Empty file" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
        return Response.json(
            {
                error: `File exceeds ${Math.round(MAX_BYTES / 1024 / 1024)} MB limit`,
            },
            { status: 413 }
        )
    }

    const noteId =
        typeof noteIdRaw === "string" && noteIdRaw.length > 0 ? noteIdRaw : null

    const key = buildR2Key(noteId, file.name)
    const bytes = new Uint8Array(await file.arrayBuffer())

    try {
        await putObject(key, bytes, file.type || null)
    } catch (error) {
        return Response.json(
            { error: error instanceof Error ? error.message : "Upload failed" },
            { status: 502 }
        )
    }

    const record = await repo.files.create({
        noteId,
        filename: file.name,
        mimeType: file.type || null,
        r2Key: key,
    })

    return Response.json(record, { status: 201 })
}
