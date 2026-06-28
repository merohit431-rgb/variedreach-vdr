import { isAxiosError } from 'axios';

export function extractErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    if (data?.error?.message) {
      return data.error.message;
    }
  }
  return 'Something went wrong. Please try again.';
}
