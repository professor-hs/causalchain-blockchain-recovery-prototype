import type { Handler } from '@netlify/functions';

const ALLOWED_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_call',
]);

const ENDPOINTS: Record<string, string> = {
  mainnet: process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  sepolia: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  if (!event.body || event.body.length > 32768) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid or oversized request body' }),
    };
  }

  try {
    const parsed = JSON.parse(event.body);
    const network = parsed.network === 'sepolia' ? 'sepolia' : 'mainnet';
    const method = String(parsed.method || '').trim();
    const params = Array.isArray(parsed.params) ? parsed.params : [];

    if (!ALLOWED_METHODS.has(method)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Disallowed JSON-RPC method: ${method}` }),
      };
    }

    const endpoint = ENDPOINTS[network];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    const rpcResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!rpcResponse.ok) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Upstream RPC HTTP status ${rpcResponse.status}` }),
      };
    }

    const data = await rpcResponse.json();
    if (data.error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: data.error.message || 'RPC Error', details: data.error }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        network,
        endpoint,
        method,
        retrievedAt: new Date().toISOString(),
        result: data.result,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal RPC proxy failure',
      }),
    };
  }
};
