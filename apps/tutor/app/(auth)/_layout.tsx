import { Stack } from 'expo-router';
import { colors } from '../../src/theme/colors';

/** Telas públicas: boas-vindas, criar conta e entrar. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
    </Stack>
  );
}
