const TARGET_SOURCE_DOMAIN = "w.royal-drama.com";
const VERIFICATION_TAG =
  "<meta name='google-site-verification' content='HWrhtgkCPV2OT-OWRzV60Vdl1pWxt35-aEZ7NNDTHWs' />";
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.handler = async (event) => {
  try {
    const inUrl = new URL(event.rawUrl);
    const workerOrigin = `${inUrl.protocol}//${inUrl.host}`;
    let path = inUrl.pathname;
    const query = inUrl.search;

    // Redirect root to /home on target
    if (path === "/") path = "/home";

    const targetUrl = `https://${TARGET_SOURCE_DOMAIN}${path}${query}`;
    const domainRegex = new RegExp(`(https?:)?\\/\\/${escapeRegex(TARGET_SOURCE_DOMAIN)}`, "gi");

    const init = {
      method: event.httpMethod,
      headers: { ...event.headers, host: TARGET_SOURCE_DOMAIN },
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
      redirect: "manual"
    };

    const upstream = await fetch(targetUrl, init);
    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();

    // --- Handle HTML pages ---
    if (contentType.includes("text/html")) {
      let html = await upstream.text();

      // ✅ Replace links only — keep CSS/JS/img untouched
      html = html.replace(
        /<a\s+([^>]*?)href=["'](https?:\/\/)?w\.royal-drama\.com([^"']*)["']/gi,
        `<a $1href="${workerOrigin}$3"`
      );

      // ✅ Add verification tag
      html = html.replace(/<head[^>]*>/i, m => `${m}\n${VERIFICATION_TAG}\n`);

      // ✅ Insert both notice boxes at top of body
      html = html.replace(
        /<body[^>]*>/i,
        m =>
          `${m}
<br><br>
<div style="margin:10px auto 24px auto;max-width:900px;border:2px solid #d32f2f;border-radius:15px;background:#fff0f0;padding:16px;text-align:center;font-family:'Tajawal',Arial,sans-serif;font-size:19px;color:#b71c1c;box-shadow:0 2px 8px #0001;line-height:1.7;">
  يرجى من صاحب موقع <b>رويال دراما</b> التواصل معي تيليغرام<br>
  <b>@Magicplans4</b><br>
  غرضي التواصل معك وليس الأذية أبداً
</div>`
      );

      // ✅ Fix relative URLs to use full absolute source for CSS/JS/images
      html = html.replace(
        /(src|href)=["'](\/(?!\/)[^"'>]+)["']/gi,
        (match, attr, relPath) =>
          `${attr}="https://${TARGET_SOURCE_DOMAIN}${relPath}"`
      );

      // ✅ Fix canonical/og:url tags
      html = html.replace(
        /<meta\s+property=["']og:url["']\s+content=["'][^"']+["']\s*\/?>/gi,
        `<meta property="og:url" content="${workerOrigin}${path}">`
      );

      const headers = {
        "content-type": "text/html; charset=UTF-8",
        "x-robots-tag": "index, follow"
      };
      return { statusCode: 200, headers, body: html };
    }

    // --- Handle XML / RSS ---
    if (contentType.includes("xml") || contentType.includes("rss") || /\.xml/i.test(inUrl.pathname)) {
      const xml = (await upstream.text()).replace(domainRegex, workerOrigin);
      return { statusCode: 200, headers: { "content-type": "application/xml; charset=UTF-8" }, body: xml };
    }

    // --- Handle all other assets (css, js, images) directly ---
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const headers = Object.fromEntries(upstream.headers.entries());
    headers["Access-Control-Allow-Origin"] = "*";
    if (/\.(css|js|jpg|jpeg|png|webp|svg|gif|woff2?|ttf|eot)$/i.test(path)) {
      headers["Cache-Control"] = "public, max-age=86400";
    }
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




