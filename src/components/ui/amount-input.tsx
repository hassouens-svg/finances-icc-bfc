"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";

/** Champ montant : clavier numérique, saisie en euros (virgule acceptée). */
export function AmountInput({ className, size = "md", ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "md" | "lg" }) {
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        pattern="[0-9]*[.,]?[0-9]{0,2}"
        className={cn(fieldBase, "num pr-9 text-right font-medium", size === "lg" ? "h-14 text-2xl" : "h-11", className)}
        {...props}
      />
      <span className={cn("pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted", size === "lg" && "text-xl")}>€</span>
    </div>
  );
}
