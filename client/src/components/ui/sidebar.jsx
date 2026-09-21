import { cn } from "@/lib/utils"

function Sidebar({ className, children, open = true, ...props }) {
  return (
    <aside
      data-slot="sidebar"
      data-open={open ? "true" : "false"}
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-background transition-[width] duration-150",
        open ? "w-64" : "w-0 overflow-hidden border-r-0",
        className,
      )}
      {...props}
    >
      {open ? children : null}
    </aside>
  )
}

function SidebarHeader({ className, ...props }) {
  return <div data-slot="sidebar-header" className={cn("flex items-center gap-2 p-3", className)} {...props} />
}

function SidebarContent({ className, ...props }) {
  return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto px-2 pb-3", className)} {...props} />
}

function SidebarFooter({ className, ...props }) {
  return <div data-slot="sidebar-footer" className={cn("border-t border-border p-2", className)} {...props} />
}

export { Sidebar, SidebarContent, SidebarFooter, SidebarHeader }
