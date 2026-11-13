import { createServer, request as proxyRequest } from 'node:http'

const gatewayPort = Number(process.env.WHATSAPP_WEBHOOK_GATEWAY_PORT) || 5006
const apiPort = Number(process.env.PORT) || 5005
const webhookPath = '/api/webhook/button-response'
const maxBodyBytes = 1024 * 1024

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  if (!['GET', 'POST'].includes(req.method) || requestUrl.pathname !== webhookPath) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }

  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength > maxBodyBytes) {
    res.writeHead(413, { 'Content-Type': 'text/plain' })
    res.end('Payload too large')
    return
  }

  const upstream = proxyRequest({
    hostname: '127.0.0.1',
    port: apiPort,
    path: `${webhookPath}${requestUrl.search}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${apiPort}`,
      connection: 'close',
    },
  }, (upstreamResponse) => {
    res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
    upstreamResponse.pipe(res)
  })

  upstream.on('error', (error) => {
    console.error(`[WhatsApp Webhook Gateway] API proxy failed: ${error.message}`)
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Webhook service unavailable')
  })
  req.pipe(upstream)
})

server.listen(gatewayPort, '127.0.0.1', () => {
  console.log(`WhatsApp webhook gateway listening on http://127.0.0.1:${gatewayPort}${webhookPath}`)
})
