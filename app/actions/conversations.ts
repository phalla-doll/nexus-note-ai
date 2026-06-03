"use server"

import { repo } from "@/lib/db"
import type { Conversation, Message } from "@/types/db"

export async function listConversations(): Promise<Conversation[]> {
    return repo.conversations.list()
}

export async function createConversation(
    title?: string | null
): Promise<Conversation> {
    return repo.conversations.create(title ?? null)
}

export async function renameConversation(
    id: string,
    title: string
): Promise<Conversation> {
    return repo.conversations.rename(id, title)
}

export async function deleteConversation(id: string): Promise<void> {
    await repo.conversations.remove(id)
}

export async function listMessages(conversationId: string): Promise<Message[]> {
    return repo.messages.listForConversation(conversationId)
}

export async function appendMessage(
    conversationId: string,
    role: Message["role"],
    content: string
): Promise<Message> {
    return repo.messages.append(conversationId, role, content)
}
