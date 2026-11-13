"use client"

import * as React from "react"
import { cn } from "cn"

/** `containerClassName` lets a long table scroll inside a fixed height (e.g. "max-h-[36rem]"); the header row stays pinned. */
function Table({ className, containerClassName, ...props }: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto overscroll-contain rounded-[6px] border border-(--line-soft) [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10",
        containerClassName && "overflow-y-auto",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full border-separate border-spacing-0 caption-bottom text-[16px]", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={className}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child_td]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/row data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-16 border-r border-b border-(--line-soft) px-7 text-left align-middle text-[14.5px] font-medium whitespace-nowrap last:border-r-0 [&:has([role=checkbox])]:pr-0 nth-[6n+1]:bg-(--blue-bg) nth-[6n+1]:text-(--blue-fg) nth-[6n+2]:bg-(--violet-bg) nth-[6n+2]:text-(--violet-fg) nth-[6n+3]:bg-(--mint-bg) nth-[6n+3]:text-(--mint-fg) nth-[6n+4]:bg-(--peach-bg) nth-[6n+4]:text-(--peach-fg) nth-[6n+5]:bg-(--pink-bg) nth-[6n+5]:text-(--pink-fg) nth-[6n]:bg-secondary nth-[6n]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-r border-b border-(--line-soft) px-7 py-6 align-middle whitespace-nowrap transition-colors duration-200 group-hover/row:bg-secondary/30 last:border-r-0 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
