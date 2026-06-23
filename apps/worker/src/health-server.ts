import http from "node:http"

export interface WorkerHealthServer {
  port: number
  close(): Promise<void>
}

export async function startWorkerHealthServer(port: number): Promise<WorkerHealthServer> {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ status: "ok", runtime: "worker" }))
  })

  await new Promise<void>((resolve) => {
    server.listen(port, "0.0.0.0", resolve)
  })

  const address = server.address()
  const boundPort = typeof address === "object" && address ? address.port : port

  return {
    port: boundPort,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      }),
  }
}