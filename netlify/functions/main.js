// Mirror function for Netlify (acts like Cloudflare Worker)
const TARGET_SOURCE_DOMAIN = "w.royal-drama.com";
const VERIFICATION_TAG =
  "<meta name='google-site-verification' content='HWrhtgkCPV2OT-OWRzV60Vdl1pWxt35-aEZ7NNDTHWs' />";
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.handler = async (event) => {
  try {
    const inUrl = new URL(event.rawUrl);
    const workerOrigin = `${inUrl.protocol}//${inUrl.host}`;
    const domainRegex = new RegExp(`(https?:)?\\/\\/${escapeRegex(TARGET_SOURCE_DOMAIN)}`, "gi");
    const targetUrl = `https://${TARGET_SOURCE_DOMAIN}${inUrl.pathname}${inUrl.search}`;

    const init = {
      method: event.httpMethod,
      headers: { ...event.headers, host: TARGET_SOURCE_DOMAIN },
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
      redirect: "manual"
    };

    const upstream = await fetch(targetUrl, init);
    const ct = (upstream.headers.get("content-type") || "").toLowerCase();

    // Handle HTML pages
    if (ct.includes("text/html")) {
      let html = await upstream.text();
      html = html
        .replace(domainRegex, workerOrigin)
        .replace(/watch\.php/gi, "view.php")
        .replace(/<head[^>]*>/i, m => `${m}\n${VERIFICATION_TAG}\n`);
      const headers = {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "index, follow"
      };
      return { statusCode: 200, headers, body: html };
    }

    // Handle XML / RSS
    if (ct.includes("xml") || ct.includes("rss") || /\.xml/i.test(inUrl.pathname)) {
      const xml = (await upstream.text()).replace(domainRegex, workerOrigin);
      return { statusCode: 200, headers: { "content-type": "application/xml; charset=utf-8" }, body: xml };
    }

    // Handle all other files (images, css, js, etc)
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const headers = Object.fromEntries(upstream.headers.entries());
    headers["Access-Control-Allow-Origin"] = "*";
    return {
      statusCode: upstream.status,
      headers,
      body: buffer.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "text/plain" },
      body: "Error: " + e.message
    };
  }
};
