import { useEffect, useCallback } from "react";

interface VideoProtectionConfig {
  onScreenCaptureDetected?: () => void;
  enableContextMenu?: boolean;
}

export const useVideoProtection = (config: VideoProtectionConfig = {}) => {
  const { onScreenCaptureDetected, enableContextMenu = false } = config;

  // Disable keyboard shortcuts for screen capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard.writeText("");
        console.warn("Screenshot attempt blocked");
        // Show warning
        onScreenCaptureDetected?.();
      }

      // Prevent common screen recording shortcuts
      if (
        (e.ctrlKey && e.shiftKey && e.key === "R") || // Chrome screen record
        (e.metaKey && e.shiftKey && e.key === "5") || // Mac screenshot
        (e.metaKey && e.shiftKey && e.key === "3") || // Mac screenshot
        (e.metaKey && e.shiftKey && e.key === "4") // Mac screenshot
      ) {
        e.preventDefault();
        console.warn("Recording shortcut blocked");
        onScreenCaptureDetected?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScreenCaptureDetected]);

  // Disable right-click on video element
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!enableContextMenu) {
        e.preventDefault();
        return false;
      }
    },
    [enableContextMenu]
  );

  // Props to apply to video container
  const videoContainerProps = {
    onContextMenu: handleContextMenu,
    style: {
      userSelect: "none" as const,
      WebkitUserSelect: "none" as const,
      msUserSelect: "none" as const,
    },
  };

  return {
    videoContainerProps,
  };
};
