import Colors from './colors';

export const gradients = {
  cardToBackground: {
    colors: [Colors.card, Colors.background] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0.7 },
  },
  topFade: {
    colors: [Colors.background, Colors.background, 'transparent'] as const,
    locations: [0, 0, 1] as const,
  },
  imageScrim: {
    colors: ['transparent', 'transparent', 'rgba(0, 0, 0, 1)'] as const,
    locations: [0, 0.5, 0.85] as const,
  },
} as const;
