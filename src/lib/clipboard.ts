/**
 * Copie fiable sur tous les navigateurs (iPhone/Safari, Android, ordinateur).
 * 1) API presse-papiers moderne ; 2) repli « textarea + execCommand » qui fonctionne aussi hors HTTPS
 * et dans les navigateurs intégrés (WhatsApp, Instagram…). Renvoie false si la copie a échoué.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* on tente le repli */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.fontSize = "16px"; // évite le zoom iOS
    document.body.appendChild(ta);
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareLink(url: string, title: string, text?: string): Promise<"shared" | "unsupported" | "cancelled"> {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title, text: text ?? title, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  return "unsupported";
}
