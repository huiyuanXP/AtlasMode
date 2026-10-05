import { HealthResponseSchema } from '@codemap/core';
import type { HealthResponse } from '@codemap/core';

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok)
    throw new Error(`API health request failed: ${response.status}`);
  return HealthResponseSchema.parse(await response.json());
}
