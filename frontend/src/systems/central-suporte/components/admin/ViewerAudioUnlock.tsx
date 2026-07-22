import { useState, useCallback } from "react";
import { Volume2 } from "lucide-react";

export function ViewerAudioUnlock() {
  const [dismissed, setDismissed] = useState(false);

  const handleUnlock = useCallback(() => {
    // Create and resume AudioContext to unlock audio
    try {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") ctx.resume();
      // Play a silent buffer to fully unlock
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch {}
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 cursor-pointer"
      onClick={handleUnlock}
      onTouchStart={handleUnlock}
    >
      <div className="flex flex-col items-center gap-6 text-center animate-pulse">
        <Volume2 className="h-24 w-24 text-primary" />
        <p className="text-3xl font-bold text-foreground">Toque para ativar o som</p>
        <p className="text-lg text-muted-foreground">Clique em qualquer lugar para iniciar</p>
      </div>
    </div>
  );
}

