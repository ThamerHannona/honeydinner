// Tap-to-talk for FridgeGenie: listens once, shows the words live, and hands back
// the final sentence ("chicken and rice, 50 grams of protein, something spicy").
// Also reads FridgeGenie's answer aloud with the on-device voice.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useApp } from '@/lib/store';

const LANG: Record<string, string> = { en: 'en-US', ar: 'ar-SA', es: 'es-US', original: 'en-US' };

export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const finalRef = useRef('');
  const activeRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setListening(false);
    const text = finalRef.current.trim();
    if (text) onFinalRef.current(text);
  }, []);

  useSpeechRecognitionEvent('result', (e) => {
    if (!activeRef.current) return;
    const text = e.results?.[0]?.transcript ?? '';
    finalRef.current = text;
    setPartial(text);
    if (e.isFinal) {
      try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
      finish();
    }
  });
  useSpeechRecognitionEvent('end', () => finish());
  useSpeechRecognitionEvent('error', () => {
    activeRef.current = false;
    setListening(false);
  });

  const start = useCallback(async () => {
    Speech.stop();
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => null);
    if (!perm?.granted) return false;
    finalRef.current = '';
    setPartial('');
    activeRef.current = true;
    setListening(true);
    try {
      ExpoSpeechRecognitionModule.start({
        lang: LANG[useApp.getState().recipeLanguage] ?? 'en-US',
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        contextualStrings: ['grams of protein', 'carbs', 'calories', 'FridgeGenie'],
      });
    } catch {
      activeRef.current = false;
      setListening(false);
      return false;
    }
    return true;
  }, []);

  /** Stop listening and use what was heard so far. */
  const stop = useCallback(() => {
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    finish();
  }, [finish]);

  useEffect(() => () => {
    activeRef.current = false;
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
    Speech.stop();
  }, []);

  return { listening, partial, start, stop };
}

/** FridgeGenie talks back (on-device voice, free, works offline). */
export function sayAloud(text: string) {
  Speech.stop();
  if (!text) return;
  const lang = useApp.getState().recipeLanguage;
  Speech.speak(text, { language: LANG[lang] ?? 'en-US', rate: 0.98, pitch: 1.05 });
}

export function stopSpeaking() {
  Speech.stop();
}

export interface MacroTargets {
  proteinMin?: number;
  carbsMax?: number;
  caloriesMax?: number;
  fatMax?: number;
}

/** Pull macro targets out of what someone said or typed. */
export function parseMacros(text: string): MacroTargets {
  const t = text.toLowerCase().replace(/grams?|gr\b/g, 'g');
  const out: MacroTargets = {};
  const n = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1]) : undefined;
  };
  out.proteinMin = n(/(\d{1,3})\s*g?\s*(?:of\s+)?protein/) ?? n(/protein\s*(?:of\s*)?(?:at least|over|above|min(?:imum)?)?\s*(\d{1,3})/);
  out.carbsMax = n(/(?:under|less than|below|max(?:imum)?|up to|no more than)\s*(\d{1,3})\s*g?\s*(?:of\s+)?carb/) ?? n(/(\d{1,3})\s*g?\s*(?:of\s+)?carbs?\s*(?:max|or less)/);
  out.caloriesMax = n(/(?:under|less than|below|max(?:imum)?|up to|no more than)\s*(\d{3,4})\s*(?:cal|kcal|calorie)/) ?? n(/(\d{3,4})\s*(?:cal|kcal|calories)\s*(?:max|or less)/);
  out.fatMax = n(/(?:under|less than|below|max(?:imum)?|up to|no more than)\s*(\d{1,3})\s*g?\s*(?:of\s+)?fat/);
  (Object.keys(out) as (keyof MacroTargets)[]).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}
