import type { Handler } from '@netlify/functions';
import { fetchTransactionAndReceipt } from '../../src/services/blockchain';
import { NetworkId } from '../../src/types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const params =
      event.httpMethod === 'POST' && event.body
        ? JSON.parse(event.body)
        : event.queryStringParameters || {};
    const network: NetworkId = params.network === 'sepolia' ? 'sepolia' : 'mainnet';
    const txHash = String(params.txHash || '').trim();

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Valid 32-byte hexadecimal txHash is required' }),
      };
    }

    const tx = await fetchTransactionAndReceipt(network, txHash);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(tx),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to fetch transaction',
      }),
    };
  }
};
