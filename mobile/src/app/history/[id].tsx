import { useLocalSearchParams } from 'expo-router';
import { ResultView } from '@/components/ResultView';

export default function HistoryResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ResultView id={id} />;
}
