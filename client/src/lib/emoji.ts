// ===========================================================================
// lib/emoji.ts: the emoji picker list and the "big emoji" check.
// ===========================================================================

/** Emoji shown in the picker, by group. */
export const EMOJI_GROUPS: [string, string[]][] = [
  ['Smileys', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😌 😍 🥰 😘 😋 😛 😜 🤪 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😠 🤯 😳 😱 🤔 🤫 🤭 🙄 😴 🤒 🤠 👻 🤖'.split(' ')],
  ['Gestures', '👍 👎 👌 ✌️ 🤞 🤟 🤘 👋 🤙 👏 🙌 🙏 🤝 💪 👀 👆 👇 👉 👈 ✋'.split(' ')],
  ['Hearts', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💞 💖 💘 💯 ✨ 🔥 ⭐ 🌟 💥 🎉'.split(' ')],
  ['Nature', '🐶 🐱 🦊 🐻 🐼 🐨 🦁 🐸 🐵 🐧 🦄 🐝 🦋 🌸 🌻 🌿 🍂 🌙 ☀️ 🌈'.split(' ')],
  ['Food', '🍎 🍋 🍉 🍓 🍑 🥑 🍕 🍔 🍟 🌮 🍿 🍩 🍪 🎂 ☕ 🍵'.split(' ')],
  ['Things', '⚽ 🎮 🎧 🎵 📱 💻 📷 🎁 🎈 📚 ✏️ 💡 🔑 🚀 ✈️ 🏠 ⏰ ✅'.split(' ')],
];

// Only emoji (plus joiners / variation selectors / spaces).
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s)+$/u;
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter() : null;

/**
 * True if the text is only emoji and at most 3 of them. Intl.Segmenter
 * counts what you see (❤️ or 👍🏽 = 1) instead of code points.
 */
export function isBigEmoji(text: string): boolean {
  if (!EMOJI_ONLY.test(text)) return false;
  const compact = text.replace(/\s/g, '');
  const count = segmenter ? [...segmenter.segment(compact)].length : [...compact].length;
  return count >= 1 && count <= 3;
}
