// app/(app)/telepherique/_layout.tsx
import { Stack } from 'expo-router';

export default function TelepheriqueLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="my-tickets" />
      <Stack.Screen name="ligne/[id]" />
      <Stack.Screen name="ticket/[id]" />
    </Stack>
  );
}
