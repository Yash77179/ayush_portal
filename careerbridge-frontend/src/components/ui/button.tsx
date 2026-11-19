import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-[0.875rem] font-medium whitespace-nowrap outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        accent: "bg-lime text-(--on-lime) hover:brightness-95",
        // Approve / verify: plain solid blue-green, no glow. The seal inside turns a notch on hover (see VerifiedBadge).
        verify:
          "bg-(--verify) text-(--verify-ink) transition-[background-color,transform] duration-200 ease-out hover:bg-[color-mix(in_oklab,var(--verify)_86%,black)] active:scale-[0.97]",
        outline:
          "border-(--hairline) bg-card text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-foreground hover:bg-foreground/[0.06] aria-expanded:bg-foreground/[0.06]",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        xs: "h-7 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 px-4 text-[0.8125rem]",
        lg: "h-12 px-7 text-[0.9375rem]",
        icon: "size-10",
        "icon-xs": "size-7",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  // Radix-style `asChild` shim: render the single child element (e.g. a Link)
  // as the button, using base-ui's `render` prop.
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ children?: React.ReactNode }>
    return (
      <ButtonPrimitive
        data-slot="button"
        nativeButton={false}
        render={child}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {child.props.children}
      </ButtonPrimitive>
    )
  }
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
