import { useEffect, useState } from "react";

export interface ToastState {
  id: number;
  message: string;
  tone: "info" | "error";
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string, tone: "info" | "error" = "info") =>
    setToast({ id: Date.now(), message, tone });

  return { toast, notify };
}

export default function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.tone}`} role="status" key={toast.id}>
      {toast.message}
    </div>
  );
}
