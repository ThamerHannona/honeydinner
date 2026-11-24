import { freshness } from './kitchen';
import type { PantryItem } from './types';

/** FridgeGenie's short, warm one-liners. */

export const timeGreeting = (d = new Date()) => {
  const h = d.getHours();
  if (h < 11) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
};

const shortName = (name: string) =>
  name
    .toLowerCase()
    .replace(/^(baby|whole|yellow|jasmine|greek|frozen|heavy)\s+/, '')
    .replace(/\s+(thighs|fillets|breast)$/, '');

export const pantryGreeting = (pantry: PantryItem[], now = new Date()) => {
  const hi = timeGreeting(now);
  if (pantry.length === 0) return `${hi}! Your kitchen's looking bare. Let's fix that.`;
  const soon = pantry
    .filter((p) => freshness(p.expiresAt) === 'soon')
    .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''));
  if (soon.length >= 2) return `${hi}! Your ${shortName(soon[0].name)} and ${shortName(soon[1].name)} need using.`;
  if (soon.length === 1) {
    const n = shortName(soon[0].name);
    const plural = /[^s]s$|ies$/.test(n) && !/(hummus|asparagus|couscous|molasses)$/.test(n);
    return `${hi}! ${plural ? 'Those' : 'That'} ${n} won't wait much longer.`;
  }
  if (pantry.some((item) => freshness(item.expiresAt) === 'expired')) {
    return `${hi}! Check those expired items. Let’s cook with what’s still fresh.`;
  }
  return `${hi}! Nothing needs using soon. Pick whatever sounds good.`;
};

export const genieSaved = (title: string) => {
  const lines = [
    `Saved! ${title} is in your recipes.`,
    `Got it! ${title} is ready when you are.`,
    `Done! ${title} is tucked away safely.`,
  ];
  return lines[title.length % lines.length];
};
