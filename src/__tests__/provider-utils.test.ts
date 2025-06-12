import { extractMetadata } from '../providers/utils';
import type { ProviderSettings } from '../types';

describe('extractMetadata', () => {
  const cfg: ProviderSettings = {
    actionType: 'deposit',
    authLink: '',
    url: '',
    method: 'GET',
    skipRequestHeaders: [],
    body: '',
    metadata: {
      platform: 'test',
      urlRegex: '',
      method: 'GET',
      fallbackUrlRegex: '',
      fallbackMethod: 'GET',
      preprocessRegex: '',
      transactionsExtraction: {
        transactionJsonPathListSelector: '$.txs',
        transactionJsonPathSelectors: {
          id: '$.id',
          amount: '$.amount',
        },
      },
      proofMetadataSelectors: [],
    },
    paramNames: [],
    paramSelectors: [],
    secretHeaders: [],
    responseMatches: [],
    responseRedactions: [],
  };

  it('extracts rows and marks hidden when values are null', () => {
    const json = {
      txs: [
        { id: 1, amount: 10 },
        { id: 2, amount: null },
      ],
    };
    const res = extractMetadata(json, cfg);
    expect(res).toEqual([
      { id: 1, amount: 10, hidden: false, originalIndex: 0 },
      { id: 2, amount: null, hidden: true, originalIndex: 1 },
    ]);
  });
});
