"use client"

/** shadcn/ui Command (cmdk): a searchable, keyboard-navigable list. Styled to the CareerBridge kit. */

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"

import { SearchIcon } from "@/components/icons"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("flex h-full w-full flex-col overflow-hidden text-popover-foreground", className)} {...props} />
}

function CommandInput({ className, wrapperClassName, ...props }: React.ComponentProps<typeof CommandPrimitive.Input> & { wrapperClassName?: string }) {
  return (
    <div data-slot="command-input-wrapper" className={cn("relative flex items-center", wrapperClassName)}>
      <SearchIcon className="pointer-events-none absolute left-4 size-[1.125rem] text-muted-foreground" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn("h-12 w-full rounded-[1rem] bg-secondary/70 pr-4 pl-11 text-[0.9375rem] outline-none ring-1 ring-transparent transition-shadow placeholder:text-muted-foreground focus:ring-foreground/15", className)}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("overflow-x-hidden overflow-y-auto overscroll-contain scroll-py-2", className)} {...props} />
}

function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-10 text-center text-[0.875rem] text-muted-foreground" {...props} />
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-1",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator data-slot="command-separator" className={cn("my-1 h-px bg-(--hairline)", className)} {...props} />
}

/** `checked` paints the chosen pill (no checkmark): violet wash with a soft inner ring. */
function CommandItem({ className, checked, ...props }: React.ComponentProps<typeof CommandPrimitive.Item> & { checked?: boolean }) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      data-checked={checked ? "" : undefined}
      className={cn(
        "relative flex cursor-default items-center gap-3 rounded-[0.875rem] px-3 py-2 text-[0.9375rem] outline-none select-none transition-[background-color,color,box-shadow] duration-150 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-secondary",
        "data-checked:bg-(--violet-bg)! data-checked:text-(--violet-fg) data-checked:data-[selected=true]:bg-[color-mix(in_oklab,var(--violet-fg)_10%,var(--violet-bg))]! data-checked:shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--violet-fg)_32%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator }
