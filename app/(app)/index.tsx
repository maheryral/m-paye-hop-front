// app/(app)/index.tsx
import { Redirect } from 'expo-router';

export default function AppIndex() {
  // Rediriger vers dashboard par défaut
  return <Redirect href="/(app)/dashboard" />;
}