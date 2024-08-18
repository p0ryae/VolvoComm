import { useEffect, useState } from "react";

export default function useTauriApi() {
  const [tauriApi, setTauriApi] = useState<any>(null);

  useEffect(() => {
    async function loadTauri() {
      const tauri = await import("@tauri-apps/api/tauri");
      setTauriApi(tauri);
    }

    loadTauri();
  }, []);

  return tauriApi;
}
