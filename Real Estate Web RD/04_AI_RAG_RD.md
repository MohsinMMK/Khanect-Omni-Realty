# AI / RAG Research and Design Document

## 1. Purpose

The omni-channel chatbot must increase lead conversion across website, WhatsApp, and Instagram while protecting the business from wrong claims. Real-estate AI cannot hallucinate availability, discounts, possession dates, RERA status, legal approvals, or financial guarantees. The system must retrieve from approved business content, answer with grounded context, calculate lead score/handoff need, and fall back when information is missing.

## 2. AI design principles

- Ground every answer in approved content.
- Prefer no answer over a risky answer.
- Ask clarifying questions when buyer intent is broad.
- Capture leads only after user intent or consent.
- Never invent price, availability, possession date, approval, or legal/financial terms.
- Keep source IDs for every answer.
- Let admins review bad answers and improve source content.
- Keep website, WhatsApp, and Instagram DM behavior consistent through one EGI conversation pipeline.
- Prefer human handoff over risky automation for high-intent, low-confidence, legal/financial, or complaint conversations.

## 3. Default local-first model approach

### Embeddings

Use BAAI/bge-m3 for embeddings because it supports more than 100 languages, input lengths up to 8192 tokens, and multiple retrieval modes. This is useful for India-first deployments where English, Hindi, Urdu/Hinglish, Telugu, Tamil, or mixed-language queries may appear. [S19]

Implementation lock:

- Store dense embeddings as `vector(1024)` in pgvector.
- Record `embedding_model`, `embedding_dimension`, `chunk_version`, and `source_version_id` with every chunk.
- Use HNSW index for production vector search after enough content exists to justify indexing.
- Use raw SQL where Drizzle abstractions are unclear for vector operators, HNSW indexes, and advanced retrieval queries.

### Generation

Use a pluggable local LLM adapter:

- Ollama for simple deployment and local model management.
- vLLM for production GPU serving with OpenAI-compatible API when the VPS has sufficient GPU resources. [S20] [S21]

The app should call the LLM through an internal `llmAdapter` interface. This keeps the system portable if the client later approves a different model/provider.

## 4. Omni-channel EGI framework

EGI is the internal channel framework for this project:

1. **Engage**: receive website chat events, WhatsApp webhooks, and Instagram DM webhooks; verify channel signatures; normalize user/channel identity; store message, consent state, and channel metadata.
2. **Ground/generate**: classify intent, retrieve approved pgvector chunks, generate safe answer/links/booking options, validate output, and calculate lead score.
3. **Integrate**: send reply through the channel adapter, create booking or lead records, sync summary/task/opportunity to Twenty, and queue human handoff when needed.

Channel-specific adapters should only handle identity, webhooks, formatting, delivery, and platform limits. Business logic lives in the shared EGI/RAG pipeline.

## 5. RAG content sources

V1 indexed sources:

- Published property/project pages.
- Approved FAQs.
- Brochure text extracted from uploaded PDFs after admin approval.
- Amenities and locality descriptions.
- Pricing display rules.
- Possession/status metadata.
- RERA metadata.
- Contact/site visit rules.
- Business profile/about content.

Do not index:

- Draft CMS content.
- Internal sales notes.
- Private lead conversations.
- Unapproved social captions.
- Raw legal documents without approved summaries.

## 6. Ingestion pipeline

1. Admin publishes content.
2. Worker loads the published content version.
3. Worker normalizes content into canonical documents.
4. Worker chunks documents by semantic sections.
5. Worker stores source records.
6. Worker generates embeddings.
7. Worker writes chunks/vectors to PostgreSQL with pgvector.
8. Worker marks index version active.

Chunking rules:

- Keep property identity in every chunk.
- Keep RERA number/status in relevant chunks.
- Keep price/availability chunks small and metadata-rich.
- Do not mix two properties in one chunk.
- Keep source URL, CMS version, and publish timestamp.

Recommended chunk metadata:

- `tenant_id`
- `content_type`
- `property_id`
- `project_id`
- `section`
- `source_version_id`
- `published_at`
- `language`
- `rera_number`
- `is_price_sensitive`
- `is_legal_sensitive`
- `embedding_model`
- `embedding_dimension`
- `chunk_version`

## 7. Retrieval pipeline

1. Classify query intent: property search, pricing, availability, booking, location, amenities, financing, legal/RERA, contact, complaint, generic.
2. Normalize query language and spelling.
3. Generate query embedding.
4. Retrieve candidate chunks with tenant/property/status filters before vector ranking.
5. Apply hybrid search: vector similarity + keyword/full-text + metadata filters.
6. Rerank candidates if local reranker is available.
7. Enforce source-version and publish-state checks so stale/draft chunks cannot answer.
8. Construct answer context with maximum source count and source diversity.
9. Generate answer with strict system prompt.
10. Validate answer against rules.
11. Calculate lead score and handoff recommendation from buyer signals.
12. Return answer, CTA, source IDs, and lead capture prompt if appropriate.

## 8. Prompt policy

System prompt must include:

- You are the real-estate assistant for this business.
- Use only provided context.
- Do not invent facts.
- If context is insufficient, say you do not have confirmed information and offer to connect the user to sales.
- For prices, availability, possession, offers, RERA, legal approvals, loan/finance, and tax matters, use cautious wording and recommend confirmation with sales/legal team.
- Never claim guaranteed returns.
- Never ask for sensitive documents in chat.
- Ask for consent before storing personal details.

## 9. Guardrails

OWASP GenAI security guidance treats prompt injection as a major LLM application risk; the RAG system must assume that user messages and retrieved documents can contain adversarial instructions. [S28] [S29]

Required guardrails:

- Separate system instructions from retrieved content.
- Strip/mark instructions inside retrieved documents as untrusted content.
- Do not allow user to override business policy.
- Do not expose hidden prompt, tokens, environment variables, API keys, or internal IDs.
- Do not execute arbitrary URLs or tools from user input.
- Limit tool access by intent.
- Log suspected prompt injection attempts.
- Apply output validation for price/RERA/legal-sensitive answers.

## 10. Confidence, lead scoring, and fallback model

Return direct answer only when:

- At least one high-confidence chunk is retrieved.
- The chunk belongs to the correct property/project/tenant.
- The chunk belongs to the current published source version.
- The answer does not require missing approval, price, legal, or real-time availability data.

Operational launch targets:

- Retrieval `topK`: start with 8-12 candidate chunks, then limit prompt context to the strongest source-diverse chunks.
- Track recall@3/recall@10 and fallback correctness in evaluation.
- Treat CPU-only local LLM as demo/low-concurrency mode. Production sales chat with strict local AI should use GPU VPS or fallback to lead-capture mode when latency is poor.

Lead scoring inputs:

- Source channel: website, WhatsApp, Instagram DM.
- Contact completeness: phone/email/name shared with consent.
- Property/project match quality.
- Budget range and timeline mentioned.
- Site visit or call request.
- Repeated engagement or multiple property comparisons.
- Sensitive/legal/financial query needing human confirmation.
- Sentiment/urgency signals.

Lead score output:

- `score`: 0-100.
- `band`: cold/warm/hot.
- `reason_codes`: concise explainable reasons.
- `recommended_action`: auto-reply, nurture, sales follow-up, urgent human handoff.

Fallback examples:

- “I do not have confirmed pricing for this unit in the approved content. I can share your details with the sales team for the latest price.”
- “I cannot confirm legal approval details from the current published information. Please verify with the sales team or the official RERA portal.”
- “I can help book a visit, but final slot confirmation will come from the team.”

## 11. Lead capture logic

Buyer intent triggers across website, WhatsApp, and Instagram:

- Asking for price.
- Asking for availability.
- Asking for site visit.
- Asking for contact/salesperson.
- Asking for payment plan.
- Comparing two properties.
- Asking about purchase timeline.
- Asking for WhatsApp/Instagram follow-up or human sales contact.

Required lead consent:

- Show consent text before storing name/phone/email.
- Store consent timestamp, source, IP hash, page URL, and purpose.
- Allow admin to export/delete on request.

## 12. RAG evaluation

Create a test set before launch:

- 50 factual property questions.
- 20 pricing/availability questions.
- 20 RERA/legal-sensitive questions.
- 20 booking/contact questions.
- 20 adversarial/prompt-injection questions.
- 20 multilingual/mixed-language questions.
- 20 channel-format tests covering website, WhatsApp, and Instagram DM message constraints.
- 20 lead scoring/handoff examples.

Metrics:

- Grounded answer rate.
- Unsupported answer rate.
- Correct fallback rate.
- Lead CTA appropriateness.
- Retrieval top-3 relevance.
- Average response latency.
- Admin-reported bad answer count.
- Lead score reason correctness.
- Handoff precision for high-intent and sensitive conversations.

Launch gate:

- Zero invented RERA/legal/price claims in test set.
- At least 90% correct fallback on missing-data cases.
- At least 85% top-3 retrieval relevance on core property questions.

## 13. AI operations

Admin dashboard should include:

- Recently asked questions.
- No-answer/fallback questions.
- Bad answer feedback.
- Source chunk viewer.
- Omni-channel conversation viewer with source IDs, action traces, lead score, and handoff state.
- Chatbot lab for testing website/WhatsApp/Instagram-style prompts before enabling live channels.
- Re-index button for published content.
- Index version history.
- LLM/embedding service health.
- Token/latency statistics.

## 14. Future AI features

Do not add in V1 unless explicitly approved:

- AI voice calling.
- Autonomous follow-up agent.
- Property recommendation engine.
- Personalized financial advice.
- Document verification.
- Unapproved outbound WhatsApp marketing blasts.

Future-safe design:

- Keep LLM adapter generic.
- Store source-grounding metadata now.
- Keep every AI tool action behind explicit permission.
