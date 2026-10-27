// One fixed color per budget concept, shared by every view.
// Class names are full literals so Tailwind can detect them.
export const CONCEPT_COLORS = {
  categories: {
    bar: 'bg-blue-400',
    iconBox: 'bg-blue-50 text-blue-600',
    chip: 'bg-blue-50 text-blue-700',
    solid: 'bg-blue-500 text-white',
  },
  obligations: {
    bar: 'bg-teal-400',
    iconBox: 'bg-teal-50 text-teal-600',
    chip: 'bg-teal-50 text-teal-700',
    solid: 'bg-teal-500 text-white',
    panel: 'bg-teal-50/30 border-teal-100',
    divider: 'border-teal-100/50',
    label: 'text-teal-600',
    input: 'focus:ring-teal-500',
    checkbox: 'text-teal-600 focus:ring-teal-500',
    button: 'bg-teal-600 hover:bg-teal-700 shadow-teal-100',
  },
  cards: {
    bar: 'bg-purple-400',
    iconBox: 'bg-purple-50 text-purple-600',
    chip: 'bg-purple-50 text-purple-700',
    solid: 'bg-purple-500 text-white',
  },
} as const;
