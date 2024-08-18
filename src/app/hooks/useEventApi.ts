import { useEffect, useState } from "react";

export default function useEventApi() {
  const [eventApi, setEventApi] = useState<any>(null);

  useEffect(() => {
    async function loadEvent() {
      const event = await import("@tauri-apps/api/event");
      setEventApi(event);
    }

    loadEvent();
  }, []);

  return eventApi;
}
