export function createCredential(
  cardId: string,
  key: string,
  previousLast4?: string,
): { last4: string; encryptedNumber: string; encryptedCvv: string };
export function revealCredential(
  cardId: string,
  key: string,
  record: { encryptedNumber: string; encryptedCvv: string },
): { number: string; cvv: string };
export function luhnValid(number: string): boolean;
