"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
    Note01Icon,
    Search01Icon,
    BubbleChatIcon,
    ConnectIcon,
    GridViewIcon,
    Folder01Icon,
    Settings02Icon,
    SparklesIcon,
} from "@hugeicons/core-free-icons"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
    href: string
    label: string
    icon: IconSvgElement
}

const primary: NavItem[] = [
    { href: "/notes", label: "Notes", icon: Note01Icon },
    { href: "/search", label: "Search", icon: Search01Icon },
    { href: "/chat", label: "Chat", icon: BubbleChatIcon },
]

const workspaces: NavItem[] = [
    { href: "/graph", label: "Graph", icon: ConnectIcon },
    { href: "/canvas", label: "Canvas", icon: GridViewIcon },
    { href: "/projects", label: "Projects", icon: Folder01Icon },
]

export function AppSidebar() {
    const pathname = usePathname()
    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(`${href}/`)

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <HugeiconsIcon
                        icon={SparklesIcon}
                        className="size-5 text-primary"
                        strokeWidth={2}
                    />
                    <span className="font-medium tracking-tight group-data-[collapsible=icon]:hidden">
                        NexusNote
                    </span>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {primary.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.href)}
                                        tooltip={item.label}
                                    >
                                        <Link href={item.href}>
                                            <HugeiconsIcon icon={item.icon} />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Explore</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {workspaces.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.href)}
                                        tooltip={item.label}
                                    >
                                        <Link href={item.href}>
                                            <HugeiconsIcon icon={item.icon} />
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            isActive={isActive("/settings")}
                            tooltip="Settings"
                        >
                            <Link href="/settings">
                                <HugeiconsIcon icon={Settings02Icon} />
                                <span>Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
