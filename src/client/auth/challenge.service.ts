import { debugLog } from '../../utils/logger';
import { HttpClient } from '../http.client';
import { ChallengeResponse } from './types';

export class ChallengeService {
  constructor(private readonly httpClient: HttpClient) {}

  async getChallenge(): Promise<{ challenge: string; timestampMs: number }> {
    debugLog('🔍 Getting challenge from KSeF...');

    const response =
      await this.httpClient.post<ChallengeResponse>('/auth/challenge');

    debugLog('✅ Challenge received');

    const timestampMs = this.extractTimestampMs(response.timestamp);

    if (!timestampMs) {
      throw new Error('Cannot extract timestampMs from challenge response');
    }

    return {
      challenge: response.challenge,
      timestampMs,
    };
  }

  private extractTimestampMs(timestamp: string): number | null {
    if (!timestamp) {
      return null;
    }

    const date = new Date(timestamp);
    if (Number.isFinite(date.getTime())) {
      return date.getTime();
    }

    return null;
  }
}
