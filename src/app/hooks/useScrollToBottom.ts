import { useEffect, useRef } from "react";

export default function useScrollToBottom<T extends HTMLElement>(dependency: any[]) {
    const containerRef = useRef<T>(null);
  
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, [...dependency]);
  
    return containerRef;
  }