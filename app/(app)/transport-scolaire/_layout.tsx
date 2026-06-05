// app/(app)/transport-scolaire/_layout.tsx
import { Stack } from 'expo-router';

export default function TransportScolaireLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="students" />
      <Stack.Screen name="student-form" />
      <Stack.Screen name="schools" />
      <Stack.Screen name="school/[id]" />
      <Stack.Screen name="route/[id]" />
      <Stack.Screen name="my-subscriptions" />
    </Stack>
  );
}
