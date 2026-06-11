// constants/fonts.ts
// Famille de polices Poppins chargée au boot (voir app/_layout.tsx).
// On expose des alias par poids pour piloter facilement la typo dans l'app.
// React Native ne dérive PAS automatiquement le bon fichier Poppins depuis
// fontWeight : il faut référencer explicitement la bonne variante via fontFamily.

export const Font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

export type FontWeightAlias = keyof typeof Font;
