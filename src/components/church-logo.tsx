"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { LogoMarkClient } from "./logo-mark-client";

/** Logo d'église avec repli sur le logo de l'application si l'image est absente. */
export function ChurchLogo({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = React.useState(!src);
  React.useEffect(() => setFailed(!src), [src]);
  if (failed) return <LogoMarkClient className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src!} alt={alt} onError={() => setFailed(true)} className={cn("size-9 shrink-0 rounded-[11px] object-cover", className)} />;
}
