export async function onRequest(context) {
  const { request, env } = context;

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        message: "SUPABASE_URL atau SUPABASE_ANON_KEY tidak dikonfigurasikan pada persekitaran Cloudflare Pages."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }

  const clientUrl = new URL(request.url);
  const subPath = clientUrl.pathname.replace(/^\/api/, "");
  const targetUrl = new URL(
    `${supabaseUrl.replace(/\/+$/, "")}${subPath}${clientUrl.search}`
  );

  // Gantikan nilai apikey penanda kepada anon key sebenar dalam parameter URL
  if (targetUrl.searchParams.get("apikey") === "edge-proxy-managed" || !targetUrl.searchParams.has("apikey")) {
    targetUrl.searchParams.set("apikey", supabaseAnonKey);
  }

  const requestHeaders = new Headers(request.headers);

  requestHeaders.delete("host");
  requestHeaders.delete("origin");
  requestHeaders.delete("referer");

  requestHeaders.set("apikey", supabaseAnonKey);

  const existingAuth = requestHeaders.get("authorization");
  if (!existingAuth || existingAuth.trim() === "" || existingAuth.includes("null") || existingAuth.includes("undefined")) {
    requestHeaders.set("authorization", `Bearer ${supabaseAnonKey}`);
  }

  // Pengendalian sambungan WebSocket (Supabase Realtime)
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    return fetch(targetUrl.toString(), {
      method: request.method,
      headers: requestHeaders
    });
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);

  let body = null;
  if (hasBody) {
    body = await request.arrayBuffer();
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: method,
      headers: requestHeaders,
      body: body,
      redirect: "follow"
    });

    const responseHeaders = new Headers(upstreamResponse.headers);

    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    const isNullBodyStatus = upstreamResponse.status === 204 || upstreamResponse.status === 304;
    const responseBody = isNullBodyStatus ? null : upstreamResponse.body;

    return new Response(responseBody, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Bad Gateway",
        message: "Gagal berhubung dengan pelayan pangkalan data upstream.",
        details: error.message
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  }
}
