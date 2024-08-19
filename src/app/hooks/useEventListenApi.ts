import { useEffect, useState } from "react";

export default function useEventListenApi() {
  const [eventListenApi, setEventListenApi] = useState<any>(null);

  useEffect(() => {
    async function loadEventListenApi() {
      const listen = (await import("@tauri-apps/api/event")).listen;
      setEventListenApi(() => listen);
    }

    loadEventListenApi();
  }, []);

  return eventListenApi;
}