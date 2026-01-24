'use client';

import { useEffect, useState } from 'react';
import FluidLanding from '../components/landing/Fluidlanding';
import { api } from '../lib/api';

export default function Home() {
  const [status, setStatus] = useState<string>('checking...');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setStatus(res.data.health))
      .catch(() => setStatus('backend unreachable'));
  }, []);

  // Optional: keep this for debugging
  console.log('Backend status:', status);

  return <FluidLanding />;
}
