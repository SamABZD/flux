import { Injectable } from '@nestjs/common';
import type { Recipient } from '../generated/prisma/client';

export type ClearingResult = { accepted: true } | { accepted: false; reason: string };
@Injectable()
export class DemoClearingService {
  async submit(recipient: Recipient | null): Promise<ClearingResult> {
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    return recipient?.bankRoute === 'demo-unavailable'
      ? {
          accepted: false,
          reason:
            'The receiving bank could not accept this transfer. No funds were moved. Try another recipient or retry later.',
        }
      : { accepted: true };
  }
}
