import { useCallback, useRef, useState } from "react";

const getSpeechRecognitionAPI = () =>
  typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Browser-reported error codes, mapped to something a user can actually act
// on. Without this, a mic failure on a different machine/browser is
// impossible to diagnose — it just silently stops with no clue why.
const ERROR_MESSAGES = {
  "not-allowed": "Microphone access was denied. Check your browser's site permissions and allow microphone access.",
  "permission-denied": "Microphone access was denied. Check your browser's site permissions and allow microphone access.",
  "audio-capture": "No microphone was found. Check that one is connected and selected as the input device.",
  "service-not-allowed": "Voice input isn't allowed on this connection — it needs HTTPS (or localhost). Ask whoever set up the server to check the URL you're using.",
  "network": "A network error interrupted voice input. Check your connection and try again.",
  "no-speech": "No speech was detected. Try again and speak after pressing the mic.",
};

// Wraps the browser's native Web Speech API (Chrome/Edge only — no key,
// no backend call, no cost). `onTranscriptChange` receives the running
// transcript for the CURRENT recording session only; the caller is
// responsible for prepending any text that existed before recording started.
export function useSpeechToText({ onTranscriptChange, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isSupported = !!getSpeechRecognitionAPI();

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!isSupported || recognitionRef.current) return;

    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalText = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      onTranscriptChange?.(finalText + interim);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      recognitionRef.current = null;
      onError?.(ERROR_MESSAGES[event.error] || `Voice input failed (${event.error}). You can keep typing your answer instead.`);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [isSupported, onTranscriptChange, onError]);

  return { isSupported, isListening, start, stop };
}
