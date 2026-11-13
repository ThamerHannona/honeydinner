// Hands-free cooking: reads each step aloud and listens for simple voice commands
// ("next", "back", "repeat", "start timer", "stop timer", "ingredients").
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export type VoiceCommand = 'next' | 'back' | 'repeat' | 'timer-start' | 'timer-stop' | 'ingredients';

const COMMANDS: [VoiceCommand, RegExp][] = [
  ['timer-start', /\b(start|set|begin)\b.*\btimer\b|\btimer\b.*\b(start|go)\b/],
  ['timer-stop', /\b(stop|pause|cancel)\b.*\btimer\b|\btimer\b.*\b(stop|pause)\b/],
  ['ingredients', /\bingredients?\b|\bwhat do i need\b/],
  ['repeat', /\b(repeat|again|say that again|what was that)\b/],
  ['back', /\b(back|previous|go back|last step)\b/],
  ['next', /\b(next|continue|done|ok next|keep going)\b/],
];

export function matchCommand(text: string): VoiceCommand | null {
  const t = text.toLowerCase();
  for (const [cmd, re] of COMMANDS) if (re.test(t)) return cmd;
  return null;
}

type Options = {
  onCommand: (cmd: VoiceCommand) => void;
};

export function useCookVoice({ onCommand }: Options) {
  const [speakOn, setSpeakOn] = useState<boolean>(true);
  const [listening, setListening] = useState<boolean>(false);
  const [heard, setHeard] = useState<string>('');
  const speakingRef = useRef<boolean>(false);
  const listeningRef = useRef<boolean>(false);
  const lastCmdAt = useRef<number>(0);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const startRecognizer = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        contextualStrings: ['next', 'back', 'repeat', 'start timer', 'stop timer', 'ingredients'],
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'default',
        },
      });
    } catch {
      /* not available (e.g. simulator) */
    }
  }, []);

  const say = useCallback(
    (text: string) => {
      Speech.stop();
      if (!speakOn || !text) return;
      speakingRef.current = true;
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.98,
        onDone: () => { speakingRef.current = false; },
        onStopped: () => { speakingRef.current = false; },
        onError: () => { speakingRef.current = false; },
      });
    },
    [speakOn],
  );

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    if (!text) return;
    setHeard(text);
    if (speakingRef.current) return; // don't react to our own voice
    const now = Date.now();
    if (now - lastCmdAt.current < 1500) return; // one command per utterance
    const cmd = matchCommand(text.split(/\s+/).slice(-5).join(' '));
    if (!cmd) return;
    lastCmdAt.current = now;
    onCommandRef.current(cmd);
    // Restart so the next utterance starts with a clean transcript.
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
  });

  useSpeechRecognitionEvent('end', () => {
    // iOS ends sessions after silence or abort; keep listening while hands-free is on.
    if (listeningRef.current) setTimeout(() => listeningRef.current && startRecognizer(), 250);
  });

  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      listeningRef.current = false;
      setListening(false);
    }
  });

  const toggleListening = useCallback(async (): Promise<boolean> => {
    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
      return false;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => null);
    if (!perm?.granted) return false;
    listeningRef.current = true;
    setListening(true);
    startRecognizer();
    return true;
  }, [startRecognizer]);

  useEffect(
    () => () => {
      listeningRef.current = false;
      Speech.stop();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
    },
    [],
  );

  return {
    speakOn,
    setSpeakOn: (on: boolean) => { if (!on) Speech.stop(); setSpeakOn(on); },
    listening,
    toggleListening,
    heard,
    say,
  };
}
