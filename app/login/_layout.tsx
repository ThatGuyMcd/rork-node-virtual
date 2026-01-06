import { Stack, Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { usePOS } from '@/contexts/POSContext';

export default function LoginLayout() {
  const { currentOperator } = usePOS();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setIsChecking(false);
  }, []);

  if (isChecking) {
    return null;
  }

  if (currentOperator) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
