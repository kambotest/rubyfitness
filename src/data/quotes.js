// Curated quotes spanning health, wellness, ageing and parenthood.
// One is shown per day on the Home tab; selection is deterministic per
// date so the quote doesn't change as you navigate around but rotates
// once at midnight local time.

export const QUOTES = [
  // ---- Health ----
  { text: 'Take care of your body. It is the only place you have to live.', author: 'Jim Rohn' },
  { text: 'The greatest wealth is health.', author: 'Virgil' },
  { text: "He who has health has hope, and he who has hope has everything.", author: 'Arabian proverb' },
  { text: 'A healthy outside starts from the inside.', author: 'Robert Urich' },
  { text: 'Walking is the best possible exercise. Habituate yourself to walk very far.', author: 'Thomas Jefferson' },
  { text: 'Movement is a medicine for creating change in a person’s physical, emotional, and mental states.', author: 'Carol Welch' },
  { text: 'Strength does not come from physical capacity. It comes from an indomitable will.', author: 'Mahatma Gandhi' },

  // ---- Wellness / mindset ----
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
  { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'You don’t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Self-care is how you take your power back.', author: 'Lalah Delia' },
  { text: 'Almost everything will work again if you unplug it for a few minutes — including you.', author: 'Anne Lamott' },
  { text: 'You can’t pour from an empty cup. Take care of yourself first.', author: 'Anonymous' },

  // ---- Ageing ----
  { text: 'Aging is not lost youth but a new stage of opportunity and strength.', author: 'Betty Friedan' },
  { text: 'Age is no barrier. It’s a limitation you put on your mind.', author: 'Jackie Joyner-Kersee' },
  { text: 'You don’t stop running because you grow old. You grow old because you stop running.', author: 'Christopher McDougall' },
  { text: 'How old would you be if you didn’t know how old you are?', author: 'Satchel Paige' },
  { text: 'The longer I live, the more beautiful life becomes.', author: 'Frank Lloyd Wright' },
  { text: 'It is never too late to be what you might have been.', author: 'George Eliot' },

  // ---- Parenthood ----
  { text: 'There is no way to be a perfect mother, and a million ways to be a good one.', author: 'Jill Churchill' },
  { text: 'A mother is she who can take the place of all others, but whose place no one else can take.', author: 'Cardinal Mermillod' },
  { text: 'The most important thing she’d learned over the years was that there was no way to be a perfect mother.', author: 'Jill Churchill' },
  { text: 'Behind every young child who believes in herself is a parent who believed first.', author: 'Matthew Jacobson' },
  { text: 'Children learn more from what you are than what you teach.', author: 'W. E. B. Du Bois' },
  { text: 'Parenthood is about raising and celebrating the child you have, not the child you thought you would have.', author: 'Joan Ryan' },
  { text: 'Your children will become what you are; so be what you want them to be.', author: 'David Bly' },
  { text: 'A mother’s strength is built quietly, day by day.', author: 'Anonymous' },
  { text: 'You don’t have to be a perfect parent. You just have to be a present one.', author: 'Anonymous' },
  { text: 'The days are long but the years are short.', author: 'Gretchen Rubin' },
];

// Deterministic-by-date selector. Same date returns the same quote so
// it doesn't flicker on re-render or while the user navigates around.
export function quoteForDate(isoDate) {
  if (!QUOTES.length) return null;
  // Hash the date string into a stable integer index.
  let h = 0;
  for (let i = 0; i < isoDate.length; i++) h = (h * 31 + isoDate.charCodeAt(i)) >>> 0;
  return QUOTES[h % QUOTES.length];
}
