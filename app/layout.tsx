import type { Metadata, Viewport } from "next"
import { Geist_Mono, Outfit } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
})

export const metadata: Metadata = {
    title: {
        default: "NexusNote AI",
        template: "%s · NexusNote AI",
    },
    description:
        "A personal AI second brain for notes, knowledge retention, and visual thinking.",
    applicationName: "NexusNote AI",
    keywords: [
        "notes",
        "second brain",
        "knowledge graph",
        "AI",
        "personal knowledge management",
    ],
    authors: [{ name: "NexusNote AI" }],
    icons: {
        icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    },
}

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    ],
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn(
                "antialiased",
                fontMono.variable,
                "font-sans",
                outfit.variable
            )}
        >
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    )
}
