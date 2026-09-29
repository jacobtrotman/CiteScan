import { useLocalSearchParams } from 'expo-router';
import { ResultView } from '@/components/ResultView';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ResultView id={id} />;
}
