import type {
  IntentSignalRequest,
  PostDepositDetailsRequest,
  SignalIntentResponse,
  PostDepositDetailsResponse,
  QuoteMaxTokenForFiatRequest,
  QuoteResponse,
  GetPayeeDetailsRequest,
  GetPayeeDetailsResponse,
} from '../types';

function headers() {
  return { 'Content-Type': 'application/json' } as const;
}

function createHeadersWithApiKey(apiKey: string) {
  return { 'Content-Type': 'application/json', 'x-api-key': apiKey } as const;
}

export async function apiSignalIntent(
  req: IntentSignalRequest,
  apiKey: string,
  baseApiUrl: string
): Promise<SignalIntentResponse> {
  const res = await fetch(`${baseApiUrl}/verify/intent`, {
    method: 'POST',
    headers: createHeadersWithApiKey(apiKey),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to signal intent: ${errorText}`);
  }
  return res.json();
}

export async function apiPostDepositDetails(
  req: PostDepositDetailsRequest,
  apiKey: string,
  baseApiUrl: string
): Promise<PostDepositDetailsResponse> {
  const res = await fetch(`${baseApiUrl}/makers/create`, {
    method: 'POST',
    headers: createHeadersWithApiKey(apiKey),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create deposit details: ${errorText}`);
  }
  return res.json();
}

export async function apiGetQuote(
  req: QuoteMaxTokenForFiatRequest,
  baseApiUrl: string
): Promise<QuoteResponse> {
  const res = await fetch(`${baseApiUrl}/quote/exact-fiat`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get quote: ${errorText}`);
  }
  return res.json();
}

export async function apiGetPayeeDetails(
  req: GetPayeeDetailsRequest,
  apiKey: string,
  baseApiUrl: string
): Promise<GetPayeeDetailsResponse> {
  const res = await fetch(
    `${baseApiUrl}/makers/${req.platform}/${req.hashedOnchainId}`,
    {
      method: 'GET',
      headers: createHeadersWithApiKey(apiKey),
    }
  );
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get payee details: ${errorText}`);
  }
  return res.json();
}
