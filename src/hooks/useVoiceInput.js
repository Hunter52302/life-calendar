import { useState, useRef, useCallback } from 'react';

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

/**
 * Wraps the browser's Web Speech API. Exposes the same shape as the mobile
 * hook so callers can use either interchangeably.
 * `transcript` is the full recognized text for the current listening session
 * (interim + final) — callers that want to append it to existing text should
 * snapshot their base text before calling start().
 */
export function useVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const supported = !!SpeechRecognitionImpl;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!supported || listening) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i++) combined += event.results[i][0].transcript;
      setTranscript(combined);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setTranscript('');
    setListening(true);
    recognition.start();
  }, [supported, listening]);

  const reset = useCallback(() => setTranscript(''), []);

  return { transcript, listening, supported, start, stop, reset };
}
