import type { AppConfig } from "@workspace/config"
import type { ProductionChatbotStore } from "@workspace/db"
import type { FastifyPluginAsync, FastifyRequest } from "fastify"
import { createHmac, timingSafeEqual } from "node:crypto"

import { handleMetaInboundMessages } from "../meta/handler.js"
import { parseInstagramInbound, parseWhatsAppInbound } from "../meta/inbound.js"

export interface MetaWebhookRouteOptions {
  config: AppConfig
  store?: ProductionChatbotStore
  fetchImpl?: typeof fetch
}

type MetaChannel = "whatsapp" | "instagram_dm"

export function metaWebhookRoutes(
  options: MetaWebhookRouteOptions
): FastifyPluginAsync {
  return async (app) => {
    const verifiedRequests = new WeakSet<FastifyRequest>()
    const parseJson = app.getDefaultJsonParser("error", "error")
    // This parser is scoped to Meta routes. Verify the original bytes, including
    // whitespace, before JSON parsing or any model/store/outbound side effects.
    app.removeAllContentTypeParsers()
    app.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (request, body, done) => {
        const secret = options.config.meta.appSecret
        const signature = request.headers["x-hub-signature-256"]
        if (
          !secret ||
          !Buffer.isBuffer(body) ||
          typeof signature !== "string" ||
          !/^sha256=[a-f0-9]{64}$/i.test(signature)
        ) {
          return done(signatureError())
        }
        const expected = createHmac("sha256", secret).update(body).digest()
        const supplied = Buffer.from(signature.slice("sha256=".length), "hex")
        if (!timingSafeEqual(expected, supplied)) return done(signatureError())
        verifiedRequests.add(request)
        parseJson(request, body.toString("utf8"), done)
      }
    )
    app.addHook("preValidation", async (request, reply) => {
      if (request.method === "POST" && !verifiedRequests.has(request)) {
        const error = signatureError()
        return reply
          .status(error.statusCode)
          .send({ error: { code: error.code, message: error.message } })
      }
    })
    for (const channel of ["whatsapp", "instagram_dm"] as const) {
      const basePath =
        channel === "whatsapp"
          ? "/webhooks/meta/whatsapp"
          : "/webhooks/meta/instagram"

      app.get(basePath, async (request, reply) => {
        const query = request.query as {
          "hub.mode"?: string
          "hub.challenge"?: string
          "hub.verify_token"?: string
        }
        const verifyToken = options.config.meta.webhookVerifyToken
        if (
          query["hub.mode"] === "subscribe" &&
          query["hub.challenge"] &&
          verifyToken &&
          query["hub.verify_token"] === verifyToken
        ) {
          return reply
            .status(200)
            .type("text/plain")
            .send(query["hub.challenge"])
        }
        return reply.status(403).send({
          error: {
            code: "WEBHOOK_VERIFY_FAILED",
            message: "Meta webhook verification failed.",
          },
        })
      })

      app.post(basePath, async (request, reply) => {
        const payload = request.body ?? {}
        const inbound =
          channel === "whatsapp"
            ? parseWhatsAppInbound(payload)
            : parseInstagramInbound(payload)

        if (!options.store || inbound.length === 0) {
          request.log.info(
            { channel, count: inbound.length },
            "meta webhook event received"
          )
          return reply
            .status(202)
            .send({ accepted: true, channel, processed: 0, replied: 0 })
        }

        const result = await handleMetaInboundMessages(
          options.config,
          options.store,
          inbound,
          options.fetchImpl
        )
        request.log.info(result, "meta webhook processed")
        return reply.status(202).send(result)
      })
    }
  }
}

export type { MetaChannel }

function signatureError() {
  return Object.assign(
    new Error("Meta webhook signature verification failed."),
    {
      statusCode: 403,
      code: "META_WEBHOOK_SIGNATURE_INVALID",
    }
  )
}
