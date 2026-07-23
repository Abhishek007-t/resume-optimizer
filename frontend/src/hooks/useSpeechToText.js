import { useCallback, useRef, useState } from "react";

const getSpeechRecognitionAPI = () =>
  typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Wraps the browser's native Web Speech API (Chrome/Edge only — no key,
// no backend call, no cost). `onTranscriptChange` receives the running
// transcript for the CURRENT recording session only; the caller is
// responsible for prepending any text that existed before recording started.
export function useSpeechToText({ onTranscriptChange } = {}) {
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

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [isSupported, onTranscriptChange]);

  return { isSupported, isListening, start, stop };
}
