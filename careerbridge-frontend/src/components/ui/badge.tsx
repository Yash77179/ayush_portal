import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-7 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-3 py-0 text-[0.8438rem] leading-none tracking-[0.005em] font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        lime: "border-[color-mix(in_oklab,var(--on-lime)_14%,transparent)] bg-lime text-(--on-lime)",
        success: "border-[color-mix(in_oklab,var(--mint-fg)_14%,transparent)] bg-(--mint-bg) text-(--mint-fg)",
        danger: "border-[color-mix(in_oklab,var(--pink-fg)_14%,transparent)] bg-(--pink-bg) text-(--pink-fg)",
        info: "border-[color-mix(in_oklab,var(--blue-fg)_14%,transparent)] bg-(--blue-bg) text-(--blue-fg)",
        warning: "border-[color-mix(in_oklab,var(--peach-fg)_14%,transparent)] bg-(--peach-bg) text-(--peach-fg)",
        violet: "border-[color-mix(in_oklab,var(--violet-fg)_14%,transparent)] bg-(--violet-bg) text-(--violet-fg)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
