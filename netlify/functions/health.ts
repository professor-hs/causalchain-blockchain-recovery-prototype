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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      status: 'ok',
      service: 'CAUSALCHAIN Evidence-Driven Recovery API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: Object.keys(ENDPOINTS),
      allowedRpcMethods: Array.from(ALLOWED_METHODS),
    }),
  };
};
