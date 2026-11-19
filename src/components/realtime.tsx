"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Client } from "appwrite";
import { realtimeJwtAction } from "@/server/actions/realtime";

const QUIET_MS = 4000;

/**
 * Rafraîchit l'écran quand une ligne change dans Appwrite (ajout d'une dépense par un collègue, nouvelle demande publique…).
 * Appwrite n'envoie que les événements des lignes que l'utilisateur a le droit de lire.
 * Le rafraîchissement attend que l'utilisateur n'interagisse plus (clic, saisie, navigation) pour ne jamais l'interrompre.
 */
export function RealtimeRefresher() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let lastInteraction = Date.now();
    const mark = () => { lastInteraction = Date.now(); };
    const events = ["pointerdown", "keydown", "input", "focusin"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const idle = Date.now() - lastInteraction;
        const editing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement;
        const dialogOpen = !!document.querySelector("[role=dialog]");
        if (idle < QUIET_MS || editing || dialogOpen || document.hidden) return schedule(QUIET_MS - Math.min(idle, QUIET_MS) + 500);
        router.refresh();
      }, delay);
    };
    (async () => {
      const jwt = await realtimeJwtAction().catch(() => null);
      if (!jwt || stopped) return;
      const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setJWT(jwt);
      unsub = client.subscribe(["rows", "documents"], () => schedule(1500));
    })();
    return () => {
      stopped = true;
      unsub?.();
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
    };
  }, [router, pathname]);
  return null;
}
