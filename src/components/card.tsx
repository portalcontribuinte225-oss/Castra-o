import { createElement } from "react";
import type { ComponentPropsWithoutRef } from "react";

type CardProps = {
  tone?: "surface" | "page";
} & (
  | ({ as?: "div" } & ComponentPropsWithoutRef<"div">)
  | ({ as: "section" } & ComponentPropsWithoutRef<"section">)
  | ({ as: "article" } & ComponentPropsWithoutRef<"article">)
  | ({ as: "form" } & ComponentPropsWithoutRef<"form">)
  | ({ as: "button" } & ComponentPropsWithoutRef<"button">)
);

export function Card({ as = "div", tone = "surface", className = "", ...props }: CardProps) {
  const background = tone === "page" ? "tw:bg-card-page" : "tw:bg-card-surface";
  return createElement(as, {
    ...(as === "button" ? { type: "button" } : {}),
    ...props,
    className: `tw:rounded-card tw:border tw:border-solid tw:border-card-border tw:aria-pressed:border-ui-accent tw:aria-pressed:bg-ui-accent-soft ${background} ${className}`.trim(),
  });
}
