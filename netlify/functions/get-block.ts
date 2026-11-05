import type { Handler } from '@netlify/functions';
import { fetchBlockByNumberOrHash } from '../../src/services/blockchain';
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
    const rawBlock = params.blockNumber ?? params.blockHash ?? 'latest';
    const blockIdentifier =
      rawBlock === 'latest'
        ? 'latest'
        : String(rawBlock).startsWith('0x')
          ? String(rawBlock)
          : parseInt(String(rawBlock), 10);

    const block = await fetchBlockByNumberOrHash(network, blockIdentifier);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(block),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to fetch block',
      }),
    };
  }
};
