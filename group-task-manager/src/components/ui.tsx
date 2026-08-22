import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-surface border border-border shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx("block text-[13px] font-medium text-muted mb-1.5", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-none",
        className
      )}
      {...props}
    />
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent text-accent-foreground active:opacity-80",
    secondary: "bg-black/[.05] text-foreground active:bg-black/[.08]",
    ghost: "text-accent active:opacity-60",
    danger: "bg-danger text-white active:opacity-80",
  };

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition disabled:opacity-40 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  const tones: Record<string, string> = {
    default: "bg-black/[.06] text-muted",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[13px] font-bold text-accent",
        className
      )}
      title={name}
    >
      {initial}
    </div>
  );
}
