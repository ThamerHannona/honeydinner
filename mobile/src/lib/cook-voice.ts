// Hands-free cooking: reads each step aloud and listens for simple voice commands
// ("next", "back", "repeat", "start timer", "stop timer", "ingredients").
// Prefers a warm OpenAI voice via the cook-speech edge function and expo-audio,
// and falls back to the best enhanced / premium iOS voice when offline.
import { useCallback, useEffect, useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { plusErrorFromResponse, plusHeaders } from '@/lib/plus';
import { useApp } from '@/lib/store';

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

const FALLBACK_RATE = 0.52;
const TTS_TIMEOUT_MS = 12000;
let cachedVoiceId: string | undefined | null = null;
let player: AudioPlayer | null = null;

function hashText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function cacheFile(key: string): File {
  return new File(Paths.cache, `cook-speech-${key}.mp3`);
}

async function cachedUri(key: string): Promise<string | null> {
  try {
    const f = cacheFile(key);
    if (f.exists) return f.uri;
  } catch { /* ignore */ }
  return null;
}

async function rememberAudio(key: string, url: string): Promise<string> {
  try {
    const f = cacheFile(key);
    if (!f.exists) {
      const res = await fetch(url);
      if (!res.ok) return url;
      const buf = new Uint8Array(await res.arrayBuffer());
      f.write(buf);
    }
    return f.uri;
  } catch {
    return url;
  }
}

const PLUS_BLOCKED = 'plus-blocked';

function cookExtrasBlocked(recipeId?: string): boolean {
  const s = useApp.getState();
  if (s.isPlus) return false;
  if (!s.freeCookRecipeId) return false;
  return !!recipeId && s.freeCookRecipeId !== recipeId;
}

async function fetchCookSpeech(text: string, recipeId?: string): Promise<string | typeof PLUS_BLOCKED | null> {
  if (cookExtrasBlocked(recipeId)) return PLUS_BLOCKED;
  const key = hashText(text.trim());
  const hit = await cachedUri(key);
  if (hit) {
    const recId = recipeId?.trim();
    if (recId && !useApp.getState().isPlus && !useApp.getState().freeCookRecipeId) {
      useApp.getState().setFreeCookRecipeId(recId);
    }
    return hit;
  }
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/functions/v1/cook-speech`, {
      method: 'POST',
      headers: plusHeaders({
        'content-type': 'application/json',
        apikey: anon,
        authorization: `Bearer ${anon}`,
      }),
      body: JSON.stringify({ text, voice: 'coral', speed: 1.1, recipeId }),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null) as { url?: string; error?: string; feature?: string } | null;
    if (plusErrorFromResponse(res.status, body, 'cook')) return PLUS_BLOCKED;
    if (!body?.url) return null;
    const recId = recipeId?.trim();
    if (recId && !useApp.getState().isPlus && !useApp.getState().freeCookRecipeId) {
      useApp.getState().setFreeCookRecipeId(recId);
    }
    return await rememberAudio(key, body.url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function pickIosVoice(): Promise<string | undefined> {
  if (cachedVoiceId !== null) return cachedVoiceId ?? undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const en = voices.filter((v) => (v.language || '').toLowerCase().startsWith('en'));
    const score = (v: Speech.Voice) => {
      const q = String(v.quality ?? '').toLowerCase();
      const n = `${v.name} ${v.identifier}`.toLowerCase();
      let s = 0;
      if (q.includes('premium') || n.includes('premium')) s += 5;
      if (q.includes('enhanced') || n.includes('enhanced')) s += 3;
      if (n.includes('siri') || n.includes('neural') || n.includes('premium')) s += 2;
      if (v.language === 'en-US' || v.language === 'en-GB' || v.language === 'en-AU') s += 1;
      if (/samantha|zoe|nicky|nora|ava|susan|karen|moira|tessa|allison|emily/.test(n)) s += 1;
      return s;
    };
    en.sort((a, b) => score(b) - score(a));
    cachedVoiceId = en[0]?.identifier ?? undefined;
    return cachedVoiceId;
  } catch {
    cachedVoiceId = undefined;
    return undefined;
  }
}

function stopPlayer() {
  try { player?.pause(); } catch { /* ignore */ }
  try { player?.remove(); } catch { /* ignore */ }
  player = null;
}

function fallbackSpeak(text: string, onDone: () => void) {
  void pickIosVoice().then((voice) => {
    Speech.speak(text, {
      language: 'en-US',
      rate: FALLBACK_RATE,
      voice,
      onDone,
      onStopped: onDone,
      onError: onDone,
    });
  });
}

type Options = {
  onCommand: (cmd: VoiceCommand) => void;
  recipeId?: string;
  extrasAllowed?: boolean;
};

export function useCookVoice({ onCommand, recipeId, extrasAllowed = true }: Options) {
  const [speakOn, setSpeakOn] = useState<boolean>(!!extrasAllowed);
  const recipeIdRef = useRef(recipeId);
  recipeIdRef.current = recipeId;
  const [listening, setListening] = useState<boolean>(false);
  useEffect(() => { if (!extrasAllowed) setSpeakOn(false); }, [extrasAllowed]);
  const [heard, setHeard] = useState<string>('');
  const speakingRef = useRef<boolean>(false);
  const listeningRef = useRef<boolean>(false);
  const lastCmdAt = useRef<number>(0);
  const onCommandRef = useRef(onCommand);
  const speakGen = useRef<number>(0);
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

  const finishSpeak = useCallback((gen: number) => {
    if (speakGen.current === gen) speakingRef.current = false;
  }, []);

  const say = useCallback(
    (text: string) => {
      const gen = ++speakGen.current;
      Speech.stop();
      stopPlayer();
      if (!speakOn || !text) {
        speakingRef.current = false;
        return;
      }
      speakingRef.current = true;
      void (async () => {
        try {
          await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
          const uri = await fetchCookSpeech(text, recipeIdRef.current);
          if (gen !== speakGen.current) return;
          if (uri === PLUS_BLOCKED) {
            speakingRef.current = false;
            return;
          }
          if (!uri) {
            fallbackSpeak(text, () => finishSpeak(gen));
            return;
          }
          const next = createAudioPlayer({ uri });
          player = next;
          const sub = next.addListener('playbackStatusUpdate', (status) => {
            if (!status.didJustFinish) return;
            try { sub.remove(); } catch { /* ignore */ }
            finishSpeak(gen);
          });
          next.play();
        } catch {
          if (gen !== speakGen.current) return;
          fallbackSpeak(text, () => finishSpeak(gen));
        }
      })();
    },
    [speakOn, finishSpeak],
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
      speakGen.current += 1;
      Speech.stop();
      stopPlayer();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
    },
    [],
  );

  return {
    speakOn,
    setSpeakOn: (on: boolean) => {
      if (!on) {
        speakGen.current += 1;
        Speech.stop();
        stopPlayer();
        speakingRef.current = false;
      }
      setSpeakOn(on);
    },
    listening,
    toggleListening,
    heard,
    say,
  };
}
