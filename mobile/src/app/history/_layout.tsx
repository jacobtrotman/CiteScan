import { router, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/lib/theme';

// History slides up as a panel over the home screen, with its own stack so
// opening a past result stays inside the panel.
export default function HistoryLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.accent,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'History',
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={{ color: theme.accent, fontSize: 17, fontWeight: '600' }}>Done</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Citations', headerBackTitle: 'History' }} />
    </Stack>
  );
}
