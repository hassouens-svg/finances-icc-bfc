"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Client } from "appwrite";
import { realtimeJwtAction } from "@/server/actions/realtime";

/**
 * Rafraîchit l'écran quand une ligne change dans Appwrite (ajout d'une dépense par un collègue, nouvelle demande publique…).
 * Appwrite n'envoie que les événements des lignes que l'utilisateur a le droit de lire.
 */
export function RealtimeRefresher() {
  const router = useRouter();
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    (async () => {
      const jwt = await realtimeJwtAction().catch(() => null);
      if (!jwt || stopped) return;
      const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setJWT(jwt);
      unsub = client.subscribe(["rows", "documents"], () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 800);
      });
    })();
    return () => { stopped = true; unsub?.(); clearTimeout(timer); };
  }, [router]);
  return null;
}
