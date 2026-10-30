// Card face backgrounds for the budget "Tarjetas" tab, so each card is told apart at a glance.
// Avoids emerald/amber/rose (status colors). Class names are full literals so Tailwind can detect them.
const CARD_FACE_GRADIENTS = [
  'bg-gradient-to-br from-purple-600 to-purple-900',
  'bg-gradient-to-br from-gray-700 to-gray-950',
  'bg-gradient-to-br from-sky-600 to-blue-900',
  'bg-gradient-to-br from-indigo-500 to-indigo-900',
  'bg-gradient-to-br from-fuchsia-600 to-purple-900',
  'bg-gradient-to-br from-cyan-600 to-slate-800',
] as const;

export const getCardFaceGradient = (index: number): string =>
  CARD_FACE_GRADIENTS[index % CARD_FACE_GRADIENTS.length];
