import { Linking, Platform } from 'react-native';

export type TeyaPaymentStatus = 'success' | 'declined' | 'cancelled' | 'error' | 'timeout';

export interface TeyaPaymentRequest {
  amountMinor: number;
  currency: string;
  reference: string;
  tipMinor?: number;
}

export interface TeyaPaymentResult {
  status: TeyaPaymentStatus;
  provider: 'Teya';
  reference: string;
  providerTransactionId?: string;
  rawUrl?: string;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

function clampInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function getCallbackUrlBase(): string {
  const expoScheme = 'rork-app';
  return `${expoScheme}://teya-callback`;
}

function buildTeyaPaymentUrl(req: TeyaPaymentRequest): string {
  const base = (process.env.EXPO_PUBLIC_TEYA_PAYMENT_URL_BASE ?? '').trim();

  const callback = getCallbackUrlBase();

  const params = new URLSearchParams({
    amount: String(clampInt(req.amountMinor)),
    currency: req.currency,
    reference: req.reference,
    callback,
  });

  if (req.tipMinor !== undefined) {
    params.set('tipAmount', String(clampInt(req.tipMinor)));
  }

  if (base) {
    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}${params.toString()}`;
  }

  return `teya://payment?${params.toString()}`;
}

function parseResultFromUrl(url: string): Partial<TeyaPaymentResult> {
  try {
    const parsed = new URL(url);
    const status = (parsed.searchParams.get('status') ?? '').toLowerCase();
    const reference = parsed.searchParams.get('reference') ?? '';
    const providerTransactionId = parsed.searchParams.get('transactionId') ?? undefined;
    const message = parsed.searchParams.get('message') ?? undefined;

    const mappedStatus: TeyaPaymentStatus =
      status === 'success' ? 'success' :
      status === 'approved' ? 'success' :
      status === 'declined' ? 'declined' :
      status === 'cancelled' ? 'cancelled' :
      status === 'canceled' ? 'cancelled' :
      status === 'timeout' ? 'timeout' :
      status ? 'error' : 'error';

    return {
      status: mappedStatus,
      reference,
      providerTransactionId,
      rawUrl: url,
      message,
    };
  } catch (e) {
    console.warn('[TeyaPayment] Failed to parse callback url:', url, e);
    return { status: 'error', rawUrl: url, message: 'Invalid callback url' };
  }
}

class TeyaPaymentService {
  async makePayment(request: TeyaPaymentRequest, opts?: { timeoutMs?: number }): Promise<TeyaPaymentResult> {
    console.log('[TeyaPayment] makePayment request:', request);

    if (Platform.OS === 'web') {
      console.warn('[TeyaPayment] Web platform detected, skipping native card machine payment');
      return {
        status: 'error',
        provider: 'Teya',
        reference: request.reference,
        message: 'Teya payments are not supported on web preview',
      };
    }

    const paymentUrl = buildTeyaPaymentUrl(request);
    console.log('[TeyaPayment] Opening payment url:', paymentUrl);

    const canOpen = await Linking.canOpenURL(paymentUrl);
    if (!canOpen) {
      console.warn('[TeyaPayment] Cannot open Teya url. Ensure the Teya app is installed and EXPO_PUBLIC_TEYA_PAYMENT_URL_BASE is correct.');
      return {
        status: 'error',
        provider: 'Teya',
        reference: request.reference,
        message: 'Could not open Teya app (missing or URL not supported)',
      };
    }

    const callbackPrefix = getCallbackUrlBase();
    console.log('[TeyaPayment] Waiting for callback prefix:', callbackPrefix);

    return await new Promise<TeyaPaymentResult>((resolve) => {
      let resolved = false;

      const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      let sub: { remove: () => void } | undefined;

      const finish = (result: TeyaPaymentResult) => {
        if (resolved) return;
        resolved = true;
        console.log('[TeyaPayment] Payment finished:', result);
        try {
          sub?.remove();
        } catch {
          // ignore
        }
        resolve(result);
      };

      const handler = (event: { url: string }) => {
        const url = event?.url ?? '';
        if (!url) return;
        if (!url.startsWith(callbackPrefix)) return;

        const parsed = parseResultFromUrl(url);
        const status = (parsed.status ?? 'error') as TeyaPaymentStatus;
        const reference = parsed.reference || request.reference;

        finish({
          status,
          provider: 'Teya',
          reference,
          providerTransactionId: parsed.providerTransactionId,
          rawUrl: parsed.rawUrl,
          message: parsed.message,
        });
      };

      sub = Linking.addEventListener('url', handler);

      setTimeout(() => {
        finish({
          status: 'timeout',
          provider: 'Teya',
          reference: request.reference,
          message: 'Timed out waiting for Teya response',
        });
      }, timeoutMs);

      Linking.openURL(paymentUrl).catch((err) => {
        console.error('[TeyaPayment] Failed to open Teya url:', err);
        finish({
          status: 'error',
          provider: 'Teya',
          reference: request.reference,
          message: 'Failed to open Teya app',
        });
      });
    });
  }
}

export const teyaPaymentService = new TeyaPaymentService();
