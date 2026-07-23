import { Mic, Square } from "lucide-react";

// Renders nothing on browsers without Web Speech API support (Firefox,
// Safari) — typing remains the only input method there, no broken UI.
function MicButton({ isListening, isSupported, onClick, className = "" }) {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={isListening ? "Stop recording" : "Answer with your voice"}
      className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center transition ${
        isListening ? "bg-danger text-white animate-pulse-glow" : "bg-primary/10 text-primary hover:bg-primary/20"
      } ${className}`}
    >
      {isListening ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
    </button>
  );
}

export default MicButton;
