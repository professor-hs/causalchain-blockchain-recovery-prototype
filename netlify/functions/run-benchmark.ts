import type { Handler } from '@netlify/functions';
import { runWorkloadBenchmark } from '../../src/services/benchmarks';
import { BenchmarkConfig } from '../../src/types';

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
    const validCounts = new Set([100, 500, 1000, 5000, 10000]);
    const txCount = validCounts.has(Number(body.transactionCount))
      ? (Number(body.transactionCount) as BenchmarkConfig['transactionCount'])
      : 100;

    const config: BenchmarkConfig = {
      transactionCount: txCount,
      stateObjectCount: Math.max(8, Math.min(Number(body.stateObjectCount) || 24, 200)),
      mismatchPercentage: Math.max(0, Math.min(Number(body.mismatchPercentage ?? 10), 90)),
      dependencyDensity:
        body.dependencyDensity === 'LOW' || body.dependencyDensity === 'HIGH'
          ? body.dependencyDensity
          : 'MEDIUM',
    };

    const result = await runWorkloadBenchmark(config);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Benchmark execution error',
      }),
    };
  }
};
