// src/utils/index.ts

export function extractTimestampMs(response: any): number | null {
  if (!response || !response.timestamp) return null;

  try {
    const date = new Date(response.timestamp);
    return date.getTime();
  } catch {
    return null;
  }
}

export function getStatusCode(response: any): number | null {
  if (!response) return null;

  if (typeof response.processingCode === 'number') {
    return response.processingCode;
  }

  if (typeof response.statusCode === 'number') {
    return response.statusCode;
  }

  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}