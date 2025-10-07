// netlify/functions/proxy.js
const TARGET_SOURCE_DOMAIN = "w.royal-drama.com";
const VERIFICATION_TAG =
  "<meta name='google-site-verification' content='HWrhtgkCPV2OT-OWRzV60Vdl1pWxt35-aEZ7NNDTHWs' />";
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.handler = async (event) => {
  try {
    const reqUrl = new URL(event.rawUrl);
    const workerOrigin = `${reqUrl.protocol}//${reqUrl.host}`;
    const domainRegex = new RegExp(`(https?:)?\\/\\/${escapeRegex(TARGET_SOURCE_DOMAIN)}`, "gi");
    const targetUrl = `https://${TARGET_SOURCE_DOMAIN}${reqUrl.pathname}${reqUrl.search}`;

    const init = {
      method: event.httpMethod,
      headers: event.headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
      redirect: "manual"
    };

    let upstream = await fetch(targetUrl, init);

    const ct = (upstream.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("text/html")) {
      let html = await upstream.text();

      html = html.replace(domainRegex, workerOrigin)
                 .replace(/watch\.php/gi, "view.php")
                 .replace(/<head[^>]*>/i, m => `${m}\n${VERIFICATION_TAG}\n`);

      const headers = { "Content-Type": "text/html; charset=utf-8" };
      return { statusCode: 200, headers, body: html };
    }

    const body = await upstream.text();
    const headers = Object.fromEntries(upstream.headers.entries());
    return { statusCode: upstream.status, headers, body };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Proxy Error: " + err.message
    };
  }
};
