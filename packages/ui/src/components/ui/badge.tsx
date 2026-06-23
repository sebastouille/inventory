import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-colors [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border bg-background text-foreground",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        destructive: "bg-destructive/15 text-destructive",
        ghost: "bg-transparent text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

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
        className: cn(badgeVariants({ variant }), className)
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant
    }
  });
}

export { Badge, badgeVariants };
