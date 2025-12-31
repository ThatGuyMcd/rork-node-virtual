import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const app = new Hono();

console.log('[Hono] Initializing backend...');

app.use("*", cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600,
  credentials: false,
}));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  })
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

app.post("/api/proxy/linkwebviewaccount", async (c) => {
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
    return new Response(text, { status: response.status });
  } catch (error: any) {
    console.error('[Proxy] linkwebviewaccount error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/proxy/webviewdataupload", async (c) => {
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
    return new Response(text, { status: response.status });
  } catch (error: any) {
    console.error('[Proxy] webviewdataupload error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/proxy/sites/:siteId/data/manifest", async (c) => {
  try {
    const siteId = c.req.param('siteId');
    const response = await fetch(`https://app.positron-portal.com/api/v1/sites/${encodeURIComponent(siteId)}/data/manifest`, {
      method: 'GET',
    });
    
    const text = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';
    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error: any) {
    console.error('[Proxy] manifest error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/proxy/sites/:siteId/data/file", async (c) => {
  try {
    const siteId = c.req.param('siteId');
    const path = c.req.query('path');
    const response = await fetch(`https://app.positron-portal.com/api/v1/sites/${encodeURIComponent(siteId)}/data/file?path=${encodeURIComponent(path || '')}`, {
      method: 'GET',
    });
    
    const text = await response.text();
    return new Response(text, { status: response.status });
  } catch (error: any) {
    console.error('[Proxy] file error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
