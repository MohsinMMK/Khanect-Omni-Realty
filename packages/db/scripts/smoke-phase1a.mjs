import { createDbClient, createDrizzlePhase1aStore, createPgPool, embedTextStubHashV1 } from "../dist/index.js"

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://realestate:change_me@localhost:5432/realestate_app"
const pool = createPgPool({ databaseUrl })
const store = createDrizzlePhase1aStore(createDbClient(pool), pool)

try {
  const token = `smoke${Date.now()}`
  const item = await store.createContent({
    contentType: "faq",
    title: `Smoke FAQ ${token}`,
    body: `${token} allows pets near the marina tram. This is approved smoke-test content.`,
  })

  const draftSearch = await store.search(token, 3)
  if (draftSearch.length !== 0) throw new Error("Draft content was indexed before publish")

  const published = await store.publishContent(item.id)
  if (published.chunkCount < 1) throw new Error("Published content did not produce chunks")

  const sourceSearch = await store.search(token, 3)
  if (sourceSearch.length < 1) throw new Error("Published content was not searchable")

  const statusPatchToken = `statuspatch${Date.now()}`
  const statusPatchItem = await store.createContent({
    contentType: "faq",
    title: `Status patch FAQ ${statusPatchToken}`,
    body: `${statusPatchToken} must stay draft until explicit publish route is called.`,
  })
  await store.patchContent(statusPatchItem.id, { status: "published" })
  const statusPatched = await store.getContent(statusPatchItem.id)
  if (statusPatched?.status !== "draft" || statusPatched.publishedVersionId !== null) {
    throw new Error("PATCH status published bypassed immutable publish flow")
  }

  const lexicalToken = `lexgate${Date.now()}`
  const collisionToken = findSingleTokenCollider(lexicalToken)
  const distractor = await store.createContent({
    contentType: "faq",
    title: `Vector distractor ${collisionToken}`,
    body: `${collisionToken} `.repeat(200),
  })
  await store.publishContent(distractor.id)
  const lexicalItem = await store.createContent({
    contentType: "faq",
    title: `Lexical target ${lexicalToken}`,
    body: `${lexicalToken} is approved content that must survive vector overfetch filtering.`,
  })
  await store.publishContent(lexicalItem.id)
  const lexicalSearch = await store.search(lexicalToken, 1)
  if (!lexicalSearch.some((source) => source.title.includes(`Lexical target ${lexicalToken}`))) {
    throw new Error("Lexical source was dropped before relevance filtering")
  }

  const unapprovedToken = `unapproved${Date.now()}`
  await store.patchContent(item.id, { body: `Unapproved draft text about ${unapprovedToken} rooftop helipad.` })
  await store.reindexContent(item.id)
  const unapprovedSearch = await store.search(unapprovedToken, 3)
  if (unapprovedSearch.length !== 0) throw new Error("Unapproved patched text was indexed")

  const fallback = await store.sendChatMessage({ message: "banana spaceship" })
  if (!fallback.fallback || fallback.sources.length !== 0) throw new Error("Irrelevant chat did not fallback")

  const sensitive = await store.sendChatMessage({ message: "What is the RERA registration number?" })
  if (!sensitive.fallback) throw new Error("Sensitive missing-data chat did not fallback")

  console.log("phase1a db smoke ok")
} finally {
  await pool.end()
}

function findSingleTokenCollider(token) {
  const target = embedTextStubHashV1(token)
  for (let index = 0; index < 100_000; index += 1) {
    const candidate = `collision${index}`
    if (cosineSimilarity(target, embedTextStubHashV1(candidate)) > 0.999999) return candidate
  }
  throw new Error(`Could not find stub embedding collision for ${token}`)
}

function cosineSimilarity(left, right) {
  let sum = 0
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index]
  return sum
}
