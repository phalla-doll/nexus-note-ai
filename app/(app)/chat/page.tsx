import { ChatView } from "@/components/chat/chat-view"

// Fixed-height chat shell: viewport minus the 3rem app header. The inner
// ChatView fills via flex-1/min-h-0 so the thread scrolls without pushing
// the composer below the fold.
export default function ChatPage() {
    return (
        <div className="mx-auto flex h-[calc(100svh-3rem)] w-full max-w-6xl flex-col p-4">
            <ChatView />
        </div>
    )
}
