import { NextRequest } from "next/server";

const REFRESH_COOKIE_NAME = "haio_admin_refresh";

const BACKEND = process.env.BACKEND_API_URL ?? "https://portal.haio.ir";

const PROXIED_REQUEST_HEADERS = [
  "content-type",
  "accept",
  "accept-language",
  "user-agent",
];

const SKIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const search = request.nextUrl.search;
  const target = `${BACKEND}/api/v1/${path.join("/")}/${search}`;

  const headers = new Headers();
  for (const name of PROXIED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const token = await resolveAccessToken(request);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { detail: "ارتباط با سرور بک‌اند برقرار نشد." },
      { status: 502 },
    );
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    // Never bounce a trailing-slash redirect back to the browser: resolve it
    // here so the client always sees the final response.
    const location = upstream.headers.get("location");
    if (location) {
      const nextUrl = new URL(location, target).toString();
      upstream = await fetch(nextUrl, {
        method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
      });
    }
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!SKIP_RESPONSE_HEADERS.has(name.toLowerCase())) {
      responseHeaders.set(name, value);
    }
  });

  const noBody = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;

  return new Response(noBody ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const dynamic = "force-dynamic";

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;

const BACKEND_REFRESH_PATH = "auth/refresh/";

async function exchangeRefreshToken(refresh: string): Promise<{ access?: string; refresh?: string } | null> {
  try {
    const upstream = await fetch(`${BACKEND}/api/v1/${BACKEND_REFRESH_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
    if (!upstream.ok) return null;
    return (await upstream.json()) as { access?: string; refresh?: string };
  } catch {
    return null;
  }
}

async function resolveAccessToken(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (auth) {
    const [scheme, token] = auth.split(" ");
    if (scheme && token && scheme.toLowerCase() === "bearer") {
      return token;
    }
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) return null;

  const exchanged = await exchangeRefreshToken(refreshToken);
  if (!exchanged?.access) return null;

  return exchanged.access;
}
