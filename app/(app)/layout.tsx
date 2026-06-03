import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app/app-sidebar"
import { CommandPalette } from "@/components/app/command-palette"
import { Separator } from "@/components/ui/separator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider delayDuration={150}>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
                        <SidebarTrigger />
                        <Separator
                            orientation="vertical"
                            className="mx-1 h-4"
                        />
                    </header>
                    <div className="flex-1 overflow-auto">{children}</div>
                </SidebarInset>
                <CommandPalette />
            </SidebarProvider>
        </TooltipProvider>
    )
}
