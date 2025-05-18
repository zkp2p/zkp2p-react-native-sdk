import type {
  IntentSignalRequest,
  PostDepositDetailsRequest,
  SignalIntentResponse,
  PostDepositDetailsResponse,
  QuoteMaxTokenForFiatRequest,
  QuoteResponse,
  GetPayeeDetailsRequest,
  GetPayeeDetailsResponse,
  GetOwnerDepositsRequest,
  GetOwnerDepositsResponse,
  GetDepositOrdersRequest,
  GetDepositOrdersResponse,
  GetDepositRequest,
  GetDepositResponse,
  Deposit,
  Intent,
} from '../types';

function headers() {
  return { 'Content-Type': 'application/json' } as const;
}

function createHeadersWithApiKey(apiKey: string) {
  return { 'Content-Type': 'application/json', 'x-api-key': apiKey } as const;
}

/**
 * Helper function to convert date strings to Date objects for deposits
 */
function convertDatesToObjects(deposit: any): Deposit {
  return {
    ...deposit,
    createdAt: deposit.createdAt ? new Date(deposit.createdAt) : undefined,
    updatedAt: deposit.updatedAt ? new Date(deposit.updatedAt) : undefined,
    verifiers: deposit.verifiers.map((verifier: any) => ({
      ...verifier,
      createdAt: verifier.createdAt ? new Date(verifier.createdAt) : undefined,
      updatedAt: verifier.updatedAt ? new Date(verifier.updatedAt) : undefined,
      currencies: verifier.currencies.map((currency: any) => ({
        ...currency,
        createdAt: currency.createdAt
          ? new Date(currency.createdAt)
          : undefined,
        updatedAt: currency.updatedAt
          ? new Date(currency.updatedAt)
          : undefined,
      })),
    })),
  };
}

/**
 * Helper function to convert date strings to Date objects for intents
 */
function convertIntentDatesToObjects(intent: any): Intent {
  return {
    ...intent,
    signalTimestamp: new Date(intent.signalTimestamp),
    fulfillTimestamp: intent.fulfillTimestamp
      ? new Date(intent.fulfillTimestamp)
      : null,
    prunedTimestamp: intent.prunedTimestamp
      ? new Date(intent.prunedTimestamp)
      : null,
    createdAt: new Date(intent.createdAt),
    updatedAt: new Date(intent.updatedAt),
  };
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

export async function apiGetOwnerDeposits(
  req: GetOwnerDepositsRequest,
  apiKey: string,
  baseApiUrl: string
): Promise<GetOwnerDepositsResponse> {
  const url = new URL(`${baseApiUrl}/deposits/maker/${req.ownerAddress}`);
  if (req.status) url.searchParams.append('status', req.status);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: createHeadersWithApiKey(apiKey),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get owner deposits: ${errorText}`);
  }
  const response = await res.json();

  // Transform dates for each deposit
  return {
    ...response,
    responseObject: response.responseObject.map(convertDatesToObjects),
  };
}

export async function apiGetDepositOrders(
  req: GetDepositOrdersRequest,
  apiKey: string,
  baseApiUrl: string
): Promise<GetDepositOrdersResponse> {
  const res = await fetch(`${baseApiUrl}/orders/deposit/${req.depositId}`, {
    method: 'GET',
    headers: createHeadersWithApiKey(apiKey),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get deposit orders: ${errorText}`);
  }
  const response = await res.json();

  // Transform dates for each intent
  return {
    ...response,
    responseObject: response.responseObject.map(convertIntentDatesToObjects),
  };
}

export async function apiGetDeposit(
  req: GetDepositRequest,
  apiKey: string,
  baseApiUrl: string
): Promise<GetDepositResponse> {
  const res = await fetch(`${baseApiUrl}/deposits/${req.depositId}`, {
    method: 'GET',
    headers: createHeadersWithApiKey(apiKey),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get deposit: ${errorText}`);
  }
  const response = await res.json();

  // Transform dates for the deposit
  return {
    ...response,
    responseObject: convertDatesToObjects(response.responseObject),
  };
}
