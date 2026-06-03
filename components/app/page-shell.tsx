import { cn } from "@/lib/utils"

export function PageShell({
    title,
    description,
    actions,
    children,
    className,
}: {
    title: string
    description?: string
    actions?: React.ReactNode
    children: React.ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                "mx-auto flex w-full max-w-5xl flex-col gap-6 p-6",
                className
            )}
        >
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {title}
                    </h1>
                    {description ? (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
                {actions ? <div className="flex gap-2">{actions}</div> : null}
            </header>
            <div className="flex flex-col gap-4">{children}</div>
        </div>
    )
}
