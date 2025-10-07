exports.handler = async (event) => {
  const TARGET_SOURCE_DOMAIN = "w.royal-drama.com";
  const reqUrl = new URL(event.rawUrl);
  const targetUrl = `https://${TARGET_SOURCE_DOMAIN}${reqUrl.pathname.replace(/^\/proxy/, "")}${reqUrl.search}`;
  const resp = await fetch(targetUrl);
  const body = await resp.text();
  return { statusCode: resp.status, headers: { "content-type": "text/html" }, body };
};
