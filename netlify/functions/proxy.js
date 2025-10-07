// netlify/functions/proxy.js
const TARGET_SOURCE_DOMAIN = "w.royal-drama.com";
const VERIFICATION_TAG =
  "<meta name='google-site-verification' content='HWrhtgkCPV2OT-OWRzV60Vdl1pWxt35-aEZ7NNDTHWs' />";
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.handler = async (event) => {
  try {
    const inUrl = new URL(event.rawUrl);
    const workerOrigin = `${inUrl.protocol}//${inUrl.host}`;
    const domainRegex = new RegExp(`(https?:)?\\/\\/${escapeRegex(TARGET_SOURCE_DOMAIN)}`, "gi");
    const path = inUrl.pathname.replace(/^\/proxy/, ""); // remove /proxy prefix
    const targetUrl = `https://${TARGET_SOURCE_DOMAIN}${path}${inUrl.search}`;

    // Copy headers
    const headers = { ...event.headers };
    delete headers["host"];

    const init = {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
      redirect: "manual"
    };

    let upstream = await fetch(targetUrl, init);
    const ct = (upstream.headers.get("content-type") || "").toLowerCase();

    // ---------------- HTML REWRITE ----------------
    if (ct.includes("text/html")) {
      let html = await upstream.text();

      html = html
        .replace(/<!--\s*Google tag \(gtag\.js\)\s*-->[\s\S]*?<script async src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"']+["']><\/script>[\s\S]*?<script>[\s\S]*?gtag\([^)]*\);[\s\S]*?<\/script>/gi, "")
        .replace(/<script[^>]*src=["']\/\/pl26380627\.revenuecpmgate\.com\/[^"']+["'][^>]*><\/script>/gi, "")
        .replace(/<script>\(function\(\)\{function c\(\)\{var b=a\.contentDocument[\s\S]*?\}\)\(\);<\/script>/gi, "")
        .replace(/<script[^>]*src=["']https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js[^"']*["'][^>]*data-cf-beacon[^>]*><\/script>/gi, "")
        .replace(/aclib\.runAutoTag\s*\(\s*\{[\s\S]*?\}\s*\)\s*;?/gi, "")
        .replace(/<script[^>]*\bid=["']?aclib["']?[^>]*src=["'](?:https?:)?\/\/acscdn\.com\/script\/aclib\.js["'][^>]*><\/script>/gi, "")
        .replace(/<script[^>]*src=["'](?:https?:)?\/\/acscdn\.com\/script\/aclib\.js["'][^>]*><\/script>/gi, "")
        .replace(/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex[^"']*["']\s*\/?>/gi, "<meta name='robots' content='index, follow'>")
        .replace(/<meta\s+content=["'][^"']*noindex[^"']*["']\s+name=["']robots["']\s*\/?>/gi, "<meta name='robots' content='index, follow'>")
        .replace(/<meta\s+name=["']googlebot["']\s+content=["'][^"']*noindex[^"']*["']\s*\/?>/gi, "")
        .replace(/<meta\s+content=["'][^"']*noindex[^"']*["']\s+name=["']googlebot["']\s*\/?>/gi, "")
        .replace(domainRegex, workerOrigin)
        .replace(/watch\.php/gi, "view.php")
        .replace(/<head[^>]*>/i, m => `${m}\n${VERIFICATION_TAG}\n`)
        .replace(
          /<body[^>]*>/i,
          m =>
            `${m}
<br><br><br>
<div style="margin:32px auto 24px auto;max-width:900px;border:2px solid green;border-radius:15px;background:#fafafa;padding:16px 10px;text-align:center;font-family:'Tajawal',Arial,sans-serif;font-size:24px;color:#d32f2f;font-weight:bold;box-shadow:0 2px 8px #0001;">
<a href='https://z.3isk.news/series/3isk-se-esref-ruya-watch/' style='color:green;text-decoration:none;'>مسلسل حلم اشرف</a>
</div>`
        );

      const headersOut = {
        "content-type": "text/html; charset=UTF-8",
        "x-robots-tag": "index, follow"
      };
      return { statusCode: 200, headers: headersOut, body: html };
    }

    // ---------------- XML & RSS ----------------
    const looksXml = /\.xml($|\?)/i.test(inUrl.pathname);
    if (
      ct.includes("application/xml") ||
      ct.includes("text/xml") ||
      ct.includes("application/rss") ||
      looksXml ||
      ct.includes("text/plain")
    ) {
      let body = await upstream.text();
      body = body.replace(domainRegex, workerOrigin);
      const mime = looksXml || ct.includes("xml") || ct.includes("rss")
        ? "application/xml; charset=UTF-8"
        : "text/plain; charset=UTF-8";
      return { statusCode: 200, headers: { "content-type": mime }, body };
    }

    // ---------------- Other files ----------------
    const arrayBuffer = await upstream.arrayBuffer();
    const buff = Buffer.from(arrayBuffer);
    const headersOut = Object.fromEntries(upstream.headers.entries());
    return {
      statusCode: upstream.status,
      headers: headersOut,
      body: buff.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "text/plain" },
      body: "Proxy Error: " + e.message
    };
  }
};
