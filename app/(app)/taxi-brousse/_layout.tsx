// app/(app)/taxi-brousse/_layout.tsx
// Stack pour les sous-écrans taxi-brousse (n'apparaît pas dans le drawer)
import { Stack } from 'expo-router';

export default function TaxiBrousseLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="my-reservations" />
      <Stack.Screen name="voyage/[id]" />
    </Stack>
  );
}
