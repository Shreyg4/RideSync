import { drainStorageCleanup } from '../_shared/storageCleanup.ts';

Deno.serve(async (req) => {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response('forbidden', { status: 403 });
  }

  try {
    await drainStorageCleanup();
    return new Response('ok');
  } catch (error) {
    console.error('drain failed', error);
    return new Response('failed', { status: 500 });
  }
});