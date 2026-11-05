import type { Handler } from '@netlify/functions';
import { runIndependentValidators } from '../../src/services/validators';

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
  if (event.httpMethod !== 'POST' || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'POST body with certificate and evidence required' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    if (!body.certificate) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing certificate field' }),
      };
    }

    const report = await runIndependentValidators({
      certificate: body.certificate,
      checkpoint: body.checkpoint || null,
      executionEvidence: Array.isArray(body.executionEvidence) ? body.executionEvidence : [],
      storageEvidence: Array.isArray(body.storageEvidence) ? body.storageEvidence : [],
      policy: body.policy || 'UNANIMOUS_3_OF_3',
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(report),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Certificate verification error',
      }),
    };
  }
};
