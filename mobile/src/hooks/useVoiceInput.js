import { useState, useCallback, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

/**
 * Wraps expo-speech-recognition. Exposes the same shape as the web hook
 * ({ transcript, listening, supported, start, stop, reset }) so ParseModal
 * can use it identically to ParseEventsModal.
 * `transcript` is the full recognized text for the current listening
 * session (interim + final) — callers that want to append it to existing
 * text should snapshot their base text before calling start().
 */
export function useVoiceInput() {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const supported = ExpoSpeechRecognitionModule.isRecognitionAvailable();

  useSpeechRecognitionEvent('start', () => { listeningRef.current = true; setListening(true); });
  useSpeechRecognitionEvent('end', () => {
    // Recognition sessions can end unexpectedly mid-dictation — restart
    // automatically while the user still intends to be listening.
    if (listeningRef.current) {
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
    } else {
      setListening(false);
    }
  });
  useSpeechRecognitionEvent('error', () => { listeningRef.current = false; setListening(false); });
  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results?.[0]?.transcript ?? '');
  });

  const start = useCallback(async () => {
    if (!supported) return;
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    setTranscript('');
    listeningRef.current = true;
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
  }, [supported]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    ExpoSpeechRecognitionModule.stop();
  }, []);

  const reset = useCallback(() => setTranscript(''), []);

  return { transcript, listening, supported, start, stop, reset };
}
