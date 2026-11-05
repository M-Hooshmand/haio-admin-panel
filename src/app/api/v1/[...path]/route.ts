import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? "https://portal.haio.ir";

const FORWARD_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "accept-language",
  "cookie",
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
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

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

  return new Response(await upstream.arrayBuffer(), {
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
