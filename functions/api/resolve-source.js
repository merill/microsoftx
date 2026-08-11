import { LearnSourceError, resolveLearnSource } from '../../src/learn-source-resolver.mjs';

const responseHeaders = {
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff'
};

function jsonResponse(body, status = 200) {
  return new Response(`${JSON.stringify(body)}\n`, { status, headers: responseHeaders });
}

export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get('url');
  try {
    const timeout = AbortSignal.timeout(8000);
    return jsonResponse(await resolveLearnSource(target, fetch, timeout));
  } catch (error) {
    const status = error instanceof LearnSourceError ? error.status : 500;
    const message = error instanceof LearnSourceError ? error.message : 'Microsoft Learn source lookup failed.';
    return jsonResponse({ error: message }, status);
  }
}

export function onRequest() {
  return jsonResponse({ error: 'Method not allowed.' }, 405);
}
