import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-surface flex field-sizing-content min-h-32 w-full rounded-[1.25rem] px-5 py-4 text-[1rem] leading-relaxed outline-none placeholder:text-muted-foreground/55 disabled:cursor-not-allowed disabled:opacity-50 md:text-[1rem]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
