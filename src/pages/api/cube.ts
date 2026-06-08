import type { APIRoute } from 'astro';

// This endpoint must run at request time, not at build time
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const cubeId = url.searchParams.get('id');
  if (!cubeId) {
    return new Response(JSON.stringify({ error: 'Missing cube id parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiUrl = `https://cubecobra.com/cube/api/cubeJSON/${cubeId}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Cube Cobra returned HTTP ${res.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to reach Cube Cobra API' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
