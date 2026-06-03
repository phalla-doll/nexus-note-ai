import "server-only"

import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { nanoid } from "nanoid"

// R2 S3-compatible client. Reads credentials from env:
//   CLOUDFLARE_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET_NAME   (defaults to nexus-note-ai-files)
//
// Generate the access key in dashboard: R2 → Manage R2 API Tokens →
// "Create API Token" with Object Read & Write on the bucket.

const BUCKET_FALLBACK = "nexus-note-ai-files"

let cached: { client: S3Client; bucket: string } | null = null

function getR2() {
    if (cached) return cached
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucket = process.env.R2_BUCKET_NAME ?? BUCKET_FALLBACK
    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error(
            "Missing R2 env. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.local."
        )
    }
    const client = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    })
    cached = { client, bucket }
    return cached
}

function safeExtension(filename: string): string {
    const match = filename.match(/\.([A-Za-z0-9]{1,10})$/)
    return match ? `.${match[1].toLowerCase()}` : ""
}

export function buildR2Key(noteId: string | null, filename: string): string {
    const prefix = noteId ? `notes/${noteId}` : "loose"
    return `${prefix}/${nanoid()}${safeExtension(filename)}`
}

export async function putObject(
    key: string,
    body: Uint8Array | Buffer,
    contentType: string | null
): Promise<void> {
    const { client, bucket } = getR2()
    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType ?? "application/octet-stream",
        })
    )
}

export async function getPresignedGetUrl(
    key: string,
    expiresSeconds = 60 * 5
): Promise<string> {
    const { client, bucket } = getR2()
    return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: expiresSeconds }
    )
}

export async function deleteObject(key: string): Promise<void> {
    const { client, bucket } = getR2()
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
