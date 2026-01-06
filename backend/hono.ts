import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

console.log('[Hono] Initializing backend...');

const ALLOWED_METHODS = "GET,POST,PUT,DELETE,OPTIONS,PATCH,HEAD";
const ALLOWED_HEADERS =
  "Content-Type,Authorization,x-trpc-source,x-trpc-batch,trpc-batch-mode,x-requested-with";

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-trpc-source",
      "x-trpc-batch",
      "trpc-batch-mode",
      "x-requested-with",
    ],
    exposeHeaders: ["Content-Type"],
    maxAge: 86400,
    credentials: false,
  })
);

app.options("*", (c) => {
  const origin = c.req.header("origin") ?? "*";
  console.log("[Hono] OPTIONS preflight:", c.req.path, "origin=", origin);
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Vary", "Origin");
  c.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
  c.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  c.header("Access-Control-Max-Age", "86400");
  return c.body(null, 204 as any);
});

app.use("/trpc/*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
  c.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  await next();
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`[tRPC] Error in ${path}:`, error);
    },
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

app.post("/proxy/linkwebviewaccount", async (c) => {
  try {
    const body = await c.req.json();
    const response = await fetch('https://app.positron-portal.com/linkwebviewaccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const text = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';
    return c.body(text, response.status as any, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error: any) {
    console.error('[Proxy] linkwebviewaccount error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/proxy/webviewdataupload", async (c) => {
  try {
    console.log('[Proxy] Received webviewdataupload request');
    const body = await c.req.json();
    console.log('[Proxy] Request body keys:', Object.keys(body));
    console.log('[Proxy] SITEID:', body.SITEID);
    console.log('[Proxy] DESTINATIONWEBVIEWFOLDER:', body.DESTINATIONWEBVIEWFOLDER);
    console.log('[Proxy] FOLDERDATA length:', body.FOLDERDATA?.length || 0);
    console.log('[Proxy] FILEDATA keys:', Object.keys(body.FILEDATA || {}));
    
    console.log('[Proxy] Forwarding to external server...');
    const response = await fetch('https://app.positron-portal.com/webviewdataupload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log('[Proxy] External server response:', response.status, response.statusText);
    const text = await response.text();
    console.log('[Proxy] External server response body:', text);
    const contentType = response.headers.get('content-type') || 'text/plain';
    return c.body(text, response.status as any, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error: any) {
    console.error('[Proxy] webviewdataupload error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/proxy/sites/:siteId/data/manifest", async (c) => {
  try {
    const siteId = c.req.param('siteId');
    const response = await fetch(`https://app.positron-portal.com/api/v1/sites/${encodeURIComponent(siteId)}/data/manifest`, {
      method: 'GET',
    });
    
    const text = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';
    return c.body(text, response.status as any, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error: any) {
    console.error('[Proxy] manifest error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/proxy/sites/:siteId/data/file", async (c) => {
  try {
    const siteId = c.req.param('siteId');
    const path = c.req.query('path');
    const response = await fetch(`https://app.positron-portal.com/api/v1/sites/${encodeURIComponent(siteId)}/data/file?path=${encodeURIComponent(path || '')}`, {
      method: 'GET',
    });
    
    const text = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';
    return c.body(text, response.status as any, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error: any) {
    console.error('[Proxy] file error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/proxy/uploadsettingsprofile", async (c) => {
  try {
    console.log('[Proxy] Received uploadsettingsprofile request');
    const body = await c.req.json();
    console.log('[Proxy] Request body keys:', Object.keys(body));
    console.log('[Proxy] Site ID:', body.siteId);
    console.log('[Proxy] Profile count:', Object.keys(body.allProfiles || {}).length);
    
    console.log('[Proxy] Forwarding to external server...');
    const response = await fetch('https://app.positron-portal.com/uploadsettingsprofile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log('[Proxy] External server response:', response.status, response.statusText);
    const text = await response.text();
    console.log('[Proxy] External server response body:', text);
    const contentType = response.headers.get('content-type') || 'text/plain';
    return c.body(text, response.status as any, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error: any) {
    console.error('[Proxy] uploadsettingsprofile error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
