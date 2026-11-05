import type { Handler } from '@netlify/functions';
import { executeCompletePatentWorkflow } from '../../src/services/pipeline';
import { buildScenarioDataset } from '../../src/data/scenarios';
import { ScenarioId } from '../../src/types';

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

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    if (body.scenarioId) {
      const scenario = await buildScenarioDataset(body.scenarioId as ScenarioId);
      const output = await executeCompletePatentWorkflow({
        network: body.network || 'mainnet',
        checkpoint: scenario.checkpoint,
        executionEvidence: scenario.executionEvidence,
        storageEvidence: scenario.storageEvidence,
        referenceEndState: scenario.referenceEndState,
        tamperCertificateAfterGen: Boolean(scenario.tamperCertificateAfterGen),
      });
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ scenario, output }),
      };
    }

    const output = await executeCompletePatentWorkflow({
      network: body.network || 'mainnet',
      checkpoint: body.checkpoint || null,
      executionEvidence: Array.isArray(body.executionEvidence) ? body.executionEvidence : [],
      storageEvidence: Array.isArray(body.storageEvidence) ? body.storageEvidence : [],
      referenceEndState: body.referenceEndState,
      tamperCertificateAfterGen: Boolean(body.tamperCertificateAfterGen),
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ output }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Analysis pipeline execution error',
      }),
    };
  }
};
