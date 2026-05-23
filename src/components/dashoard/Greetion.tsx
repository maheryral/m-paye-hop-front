// src/components/Greeting.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface GreetingProps {
  user?: { firstName?: string; lastName?: string };
}

const Greeting: React.FC<GreetingProps> = ({ user }) => {
  const { colors } = useTheme();
  const hour = new Date().getHours();
  let greeting = 'Bonjour';
  if (hour >= 12 && hour < 18) greeting = 'Bon après-midi';
  if (hour >= 18) greeting = 'Bonsoir';

  return (
    <View>
      <Text style={[styles.greeting, { color: colors.text }]}>{greeting},</Text>
      <Text style={[styles.name, { color: colors.text }]}>
        {user?.firstName || 'Utilisateur'} {user?.lastName || ''}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Voici le résumé de votre activité financière.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  greeting: {
    fontSize: 14,
    opacity: 0.7,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default Greeting;