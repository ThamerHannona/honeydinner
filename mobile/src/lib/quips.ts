/** FridgeGenie's one-liners. A sprinkle of humor in the moments that matter. */
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

export const quip = {
  cooked: (title: string) =>
    pick([
      `${title} — nailed it! Chef’s kiss. 🤌`,
      `${title}: done. Somewhere, Gordon Ramsay nods silently.`,
      `Dinner is served. Dishes are… someone else’s problem. 😇`,
      `${title} complete. You may now accept compliments.`,
    ]),
  stocked: (n: number) =>
    pick([
      `${n} items stocked. Your fridge has never felt so seen.`,
      `${n} items in. I’ll keep an eye on them (lovingly).`,
      `${n} items stocked. The yogurt from March has been notified.`,
    ]),
  shoppingDone: () =>
    pick([
      'Shopping done! Unpacking is not my department. 🛍️',
      'Back from the hunt. Checked items are in your kitchen.',
      'Mission accomplished. Snacks you didn’t list are between you and the cart.',
    ]),
  addedToList: (name: string) => pick([`${name} added. Don’t forget it in the car.`, `${name} is on the list.`, `${name} added — noted, chef.`]),
  deleted: (title: string) => pick([`Deleted ${title}. It had a good run.`, `${title} is gone. No hard feelings.`, `Bye, ${title}. 👋`]),
  sentRecipe: (to: string) => pick([`Sent to ${to} 💌 Subtle hint delivered.`, `Sent to ${to} 💌 The hint has been dropped.`, `${to} has been gently persuaded. 💌`]),
  passed: (n: number) =>
    n >= 3
      ? pick(['Picky tonight! Want me to invent something from your fridge?', 'Three strikes. Let me cook something up from what you have.', 'Tough crowd. Shall I conjure a new idea?'])
      : pick(['Fair. Next contestant…', 'Not feeling it? No problem.', 'Swiped. Here’s another.', 'Noted. The genie adapts.']),
  locked: (title: string, partner: string | null) =>
    partner ? pick([`${title} it is! I told ${partner}. 💌`, `Locked in. ${partner} has been informed.`]) : pick([`${title} it is! 🍽️`, 'Locked in. Dinner is decided. 🎉']),
};
