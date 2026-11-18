export async function onRequestGet(context) {
  const env = (context && context.env) || {};
  const supabaseUrl = typeof env.SUPABASE_URL === "string" ? env.SUPABASE_URL.trim() : "";
  const supabaseAnonKey = typeof env.SUPABASE_ANON_KEY === "string" ? env.SUPABASE_ANON_KEY.trim() : "";
  const gasEndpointUrl = typeof env.GAS_ENDPOINT_URL === "string" ? env.GAS_ENDPOINT_URL.trim() : "";

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache"
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        message: "Required environment variables SUPABASE_URL or SUPABASE_ANON_KEY are missing or empty."
      }),
      {
        status: 500,
        headers
      }
    );
  }

  const payload = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey
  };

  if (gasEndpointUrl) {
    payload.GAS_ENDPOINT_URL = gasEndpointUrl;
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers
  });
}