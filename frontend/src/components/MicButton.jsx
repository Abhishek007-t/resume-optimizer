import { Mic, MicOff, Square } from "lucide-react";

// Shown disabled (not hidden) on browsers without Web Speech API support
// (Firefox, Safari) — a silently-missing button is indistinguishable from
// "broken" when someone hits this on a different machine. A visible,
// explained disabled state at least tells them why.
function MicButton({ isListening, isSupported, onClick, className = "" }) {
  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input isn't supported in this browser — try Chrome or Edge instead, or just type your answer."
        className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-bg-card text-text-secondary opacity-50 cursor-not-allowed ${className}`}
      >
        <MicOff size={16} />
      </button>
    );
  }

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
