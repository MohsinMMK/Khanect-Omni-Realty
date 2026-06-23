import { describe, expect, it } from "vitest"

import { parseInstagramInbound, parseWhatsAppInbound } from "../src/meta/inbound.js"

describe("meta inbound parsers", () => {
  it("parses WhatsApp text messages", () => {
    const messages = parseWhatsAppInbound({
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "123456" },
            messages: [{
              from: "16505551234",
              id: "wamid.TEST",
              type: "text",
              text: { body: "Looking for 2BR near marina" },
            }],
          },
        }],
      }],
    })
    expect(messages).toEqual([{
      channel: "whatsapp",
      externalUserId: "16505551234",
      messageId: "wamid.TEST",
      text: "Looking for 2BR near marina",
      phoneNumberId: "123456",
    }])
  })

  it("parses Instagram DM text messages", () => {
    const messages = parseInstagramInbound({
      object: "instagram",
      entry: [{
        id: "17841400000000000",
        messaging: [{
          sender: { id: "2323232323" },
          message: { mid: "mid.TEST", text: "Do you have parking?" },
        }],
      }],
    })
    expect(messages).toEqual([{
      channel: "instagram_dm",
      externalUserId: "2323232323",
      messageId: "mid.TEST",
      text: "Do you have parking?",
      instagramAccountId: "17841400000000000",
    }])
  })
})