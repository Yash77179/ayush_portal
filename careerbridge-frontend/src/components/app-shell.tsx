"use client"

import * as React from "react"
import { ViewTransition } from "react"
import { usePathname } from "next/navigation"

import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

/** Persistent chrome for every signed-in page: sidebar + header + content column. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <SidebarProvider style={{ "--sidebar-width": "19.5rem", "--sidebar-width-icon": "6.25rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <AppHeader />
        <ViewTransition key={pathname} name="page" enter="page-enter" exit="page-exit" default="none">
          <main className="mx-auto w-full max-w-[117.5rem] px-5 pt-8 pb-20 sm:px-8 lg:px-10 lg:pt-10 2xl:px-14">{children}</main>
        </ViewTransition>
      </SidebarInset>
    </SidebarProvider>
  )
}
