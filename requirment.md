Here is a straight up plan for what you want to build, no code, just structure.

---

## 1. Goal and constraints

You are building:

* A Next.js app that lets a logged in user upload a PDF.
* The backend extracts text, chunks it, embeds it with OpenAI, and stores vectors in Supabase (pgvector).
* The chat UI uses AI SDK to talk to a route that:

  * Retrieves only chunks from that PDF for that user from Supabase.
  * Builds a prompt with those chunks.
  * Forces the model to answer only from that context or say “not in the document”.

This is basically the AI SDK RAG Agent pattern, but with Supabase instead of Neon + Drizzle, and with PDFs instead of free text. ([AI SDK][1])

---

## 2. Tech stack decisions

Clarify these first:

* Frontend

  * Next.js App Router.
  * AI SDK React hooks (`useChat`) for the chat UI. ([Medium][2])
  * Basic UI library (shadcn is fine, but not critical to the plan).

* Backend

  * Next.js route handlers under `app/api`.
  * AI SDK server helpers (`streamText`, `embed` / `embedMany`) to call OpenAI. ([AI SDK][1])
  * Supabase Postgres with pgvector extension (built in).

* Supabase

  * Auth for users.
  * Storage for raw PDFs.
  * Database tables for documents and chunks.
  * Row level security so each user sees only their own documents.

* Models

  * Embeddings: OpenAI `text-embedding-3-small` (from the Medium RAG article). ([Medium][2])
  * Chat: any GPT model via AI SDK.

---

## 3. Data model in Supabase

You do not need Drizzle schemas for this plan, just tables.

Required tables:

1. `profiles`

   * Supabase’s usual user profile table, keyed by `user_id` that matches `auth.uid()`.

2. `documents`

   * `id` (uuid)
   * `user_id` (uuid, FK to `profiles.user_id` or direct to `auth.users`)
   * `title` (text)
   * `original_filename` (text)
   * `storage_path` (text, path in Supabase Storage)
   * `status` (enum or text: `processing`, `ready`, `failed`)
   * `page_count` (int, optional)
   * `created_at`, `updated_at`
   * Optional: `metadata_json` (for any extra stuff, like tags).

3. `document_chunks`

   * `id` (uuid)
   * `document_id` (uuid, FK to `documents.id` on delete cascade)
   * `chunk_index` (int)
   * `content` (text, the raw text of the chunk)
   * `token_count` (int)
   * `embedding` (vector, pgvector type, dimension matching your embedding model)
   * `created_at`

4. Optional later: `conversations` and `messages` if you want persistent chat history per document.

RLS policies:

* On `documents` and `document_chunks`:

  * Select, insert, update, delete only where `user_id = auth.uid()` or via join on `documents.user_id`.
* On Storage bucket for PDFs:

  * Only owner user can list or read their files.

This is what keeps each user’s knowledge base isolated and is consistent with how the AI SDK RAG guide separates resources and embeddings in a separate table. ([AI SDK][1])

---

## 4. User flows

Think in flows, not code.

### 4.1 Auth flow

* User visits app.
* If not logged in:

  * Supabase Auth sign in or sign up (email magic link, OAuth, whatever you like).
* Once logged in, app fetches:

  * List of their `documents` where `status = ready | processing`.

No AI involved here.

### 4.2 PDF upload and ingestion flow

End result: after this flow, `document_chunks` is filled with vectors for that PDF and `status` is `ready`.

Steps:

1. User clicks “Upload PDF”.

2. Client:

   * Uses Supabase client to upload the file to a Storage bucket.
   * After success, calls an internal API route, something like `/api/documents/create`, sending:

     * `title`
     * `original_filename`
     * `storage_path`
     * Current `user_id` (resolved on server via Supabase auth, not trusted from client).

3. Server (Next.js route handler):

   * Validates the Supabase session, gets `user_id`.
   * Inserts row into `documents` with `status = processing`.
   * Triggers ingestion:

     * For simple version: run ingestion inline in this request.
     * For realistic version: enqueue a background job via Supabase Functions or a simple cron/worker pattern so you do not block the request for big PDFs.

4. Ingestion job responsibilities:

   Conceptually:

   * Download PDF from Supabase Storage.
   * Extract text per page or overall.
   * Chunk the text.

     * Use a simple chunking strategy at first (for example, fixed character length chunks with overlap), similar to the sentence or text splitting described in the AI SDK guide and the Medium article. ([AI SDK][1])
     * Keep track of `chunk_index` and optional page number.
   * Call OpenAI embeddings:

     * For each chunk, generate an embedding with `text-embedding-3-small`.
     * Batch requests if you want to be efficient, but not required in v1.
   * Insert into `document_chunks`:

     * For each chunk, insert a row with `document_id`, `chunk_index`, `content`, `token_count`, `embedding`.
   * When all chunks are inserted:

     * Update `documents.status` to `ready`.

5. Frontend:

   * Poll `/api/documents/:id` or refetch on interval while `status = processing`.
   * Once `status = ready`, show “Chat with this document” button.

### 4.3 Chat flow (per document)

Goal: for each question, embed the query, retrieve similar chunks, feed only those to the model, and forbid it from freelancing.

Steps:

1. On document page, you have:

   * Document metadata (title etc).
   * Chat UI built with `useChat` from AI SDK, configured so each message also passes `document_id` in the request body. ([Medium][2])

2. Client sends messages to `/api/chat`:

   * Payload includes:

     * `messages` (user + assistant history, as normal AI SDK).
     * `document_id` for the active PDF.

3. Server route `/api/chat`:

   Logical steps, no code:

   * Validate Supabase session, get `user_id`.
   * Check that `document_id` belongs to `user_id` and `status = ready`. If not, error out.
   * Take the latest user message text.
   * Generate an embedding for this question using the same embedding model you used for chunks. ([Medium][2])
   * Use Supabase to query `document_chunks`:

     * Filter by `document_id` only.
     * Order by vector similarity to the query embedding.
     * Limit to a reasonable number of chunks (for example 10).
     * Apply a similarity threshold to avoid junk matches.
   * Concatenate the top chunks into a context string, including maybe `chunk_index` or page info.

4. Guardrail: if no good matches

   * If every similarity score is worse than your threshold:

     * Do NOT call the chat model.
     * Return a simple answer such as:

       * “This PDF does not seem to contain information about that question.”

   That is how you enforce “only answer from that PDF” instead of letting the model hallucinate.

5. Building the final prompt

   * When you have relevant chunks, build a system message that tells the model:

     * You are a PDF assistant.
     * You can only answer using the provided context from this document.
     * If the context is not enough, you must say you do not know and that the document does not cover this.
     * You may quote or paraphrase the context but cannot bring in outside knowledge.

   * This is exactly the pattern from the AI SDK RAG Agent and the Medium article, except you tighten the rule so it must not answer outside the context. ([AI SDK][1])

6. Call AI SDK server helper

   * Use AI SDK on the server to call the chat model with:

     * System message described above.
     * User messages so the model sees the conversation.
   * Stream the response back using AI SDK streaming so `useChat` on the client can show it in real time.

7. Client renders messages

   * `useChat` handles streaming, errors, loading states.
   * You style messages in the UI.

---

## 5. Strict “only answer from this PDF” behavior

Your constraints live at three levels:

1. Retrieval filter

   * Only search `document_chunks` for that `document_id`.
   * Enforce a similarity threshold.
   * If the result set is empty or scores are terrible:

     * Short circuit and answer “not in document”.

2. System prompt constraints

   * Very explicit instructions:

     * “You must base your answer only on the context from this PDF.”
     * “If the context does not answer the question, say that clearly.”
   * Remind the model it is not allowed to invent external facts.

3. Optional response checker

   * Later, you can add a simple rule based checker:

     * For example, you can ask a second pass “Does this answer directly reference the context” and reject answers that look like pure general knowledge.
   * This is v2, not needed for first version.

Combine retrieval threshold plus system prompt and you will get very low hallucination rates for this use case.

---

## 6. Project structure (high level)

Folders and pages, still no code.

* `app/(auth)/login` and `app/(auth)/signup`

  * Supabase auth, basic forms.

* `app/documents/page`

  * Lists user’s documents from Supabase.
  * Shows status: processing, ready, failed.
  * Upload form for PDF.

* `app/documents/[id]/page`

  * Shows document title and metadata.
  * Chat interface for that document.
  * Optionally preview PDF on the side.

* `app/api/documents/create`

  * Validates auth.
  * Creates `documents` row, triggers ingestion.

* `app/api/chat`

  * Validates auth.
  * Checks `document_id` ownership.
  * Embeds question.
  * Retrieves chunks from `document_chunks`.
  * Builds prompt and calls AI SDK chat.
  * Streams response.

* Background ingestion

  * Either:

    * `app/api/documents/ingest` called manually after create.
    * Or Supabase Function that reacts to a `documents` insert and runs the pipeline.

---

## 7. Environment and keys

You will need:

* OpenAI API key for embeddings and chat.
* Supabase URL and anon key for client.
* Supabase service role key on the server side for ingestion and RLS safe operations if needed.
* AI SDK configuration that points to OpenAI directly (as in the guides) or through Vercel AI Gateway if you prefer that model routing. ([AI SDK][1])

Keep a clean .env schema from day one so you are not debugging “undefined key” later.

---

## 8. Milestones so you do not drown

Build this in small steps:

1. Auth + PDF upload to Supabase + `documents` table.
2. Offline script or route that takes a single PDF, extracts text, chunks it, writes rows into `document_chunks` with dummy embeddings.
3. Swap dummy embeddings for real OpenAI embeddings.
4. Implement `/api/chat` that:

   * Embeds query.
   * Queries Supabase with basic similarity.
   * Returns raw chunk list to the client (no model yet) so you can inspect retrieval.
5. Only after retrieval is solid:

   * Wrap it in AI SDK chat call with strict system prompt.
   * Wire via `useChat` on the frontend.

Once this works for a single PDF and a single user, you can layer in multiple documents, better chunking, history, and more UI sugar.

[1]: https://ai-sdk.dev/cookbook/guides/rag-chatbot "Cookbook: RAG Agent"
[2]: https://medium.com/%40olliedoesdev/create-a-rag-application-using-next-js-supabase-and-openais-text-embedding-3-small-model-7f290c028766 "Create a RAG application using Next.JS, Supabase and OpenAI’s text-embedding-3-small model | by Ollie | Medium"
Short answer: yes, you’re on the right path, but the client brief is judging **experience + workflow**, not just tech choices, so you need to be very intentional about UX and some guardrails.

Let me map your plan to what a picky client will look for.

---

## 1. Does your stack match the brief?

Client wants:

* RAG chatbot
* Upload any PDF or `.txt`
* UI for chatting
* Answers **only from the user document**

Your current plan:

* Next.js + Vercel AI SDK RAG pattern ([AI SDK][1])
* Supabase + pgvector for embeddings ([Medium][2])
* OpenAI `text-embedding-3-small` + GPT model ([Medium][2])

That aligns almost perfectly with the AI SDK RAG cookbook and the Medium “Next.js + Supabase + OpenAI” article. ([AI SDK][1])

So tech-wise: ✅ solid, standard, nothing weird.

---

## 2. What the client will actually judge you on

This line is the key:

> “Exercise your judgement on the experience user should have, the workflow is something we will judge you on as well.”

So they are not just asking “can you call `embedMany` and write to pgvector?”
They are asking “can you design a **clean, sane flow** for a non-technical user?”

You need to be very intentional about:

### a) First-time user journey

Think like this:

1. User lands on app
2. Sees a simple hero like: “Chat with your documents” + “Upload file”
3. After upload:

   * show **processing state** (“Indexing your document… 40%”)
   * then transition to a chat view: “You’re now chatting with: `my-file.pdf`”

This is what the Supabase “chatgpt-your-files” workshop does very well: tight loop of upload → process → chat. ([GitHub][3])

If your app just dumps them into a random chat UI with a tiny upload button somewhere, they’ll ding you on UX.

### b) Multi-document thinking

They said “user can upload *any* PDF or txt”, not just one. So your UX should handle:

* A **documents list** (like “recent docs”)
* Explicit “You’re now chatting with: <doc>” indicator
* Ability to switch documents without mixing context

This is the same pattern as the Vercel “RAG with AI SDK” template and Supabase chat-with-your-files demos. ([Vercel][4])

If all your docs are mixed into one big vector soup, they will spot that and ask “how do you ensure it only uses *this* file?”.

### c) “Only answer from document” guardrails

You *said* you want this, the client also wants it. To actually enforce it you need three things:

1. **Retrieval filter**

   * Only query `document_chunks` where `document_id = activeDoc`.
   * Use a similarity threshold; if no chunk is close enough, treat it as “not found”.

2. **System prompt**

   * Very explicit instruction:

     * answer only from provided context
     * if context doesn’t contain the info, say “The document doesn’t mention that.”

3. **Empty-result behavior**

   * If retrieval returns nothing above threshold → skip model call, return a fixed message:

     * “I couldn’t find anything about that in this document.”

This “strict RAG” pattern is very close to how the AI SDK RAG guide recommends composing context, you’re just being stricter on allowing answers without context. ([AI SDK][1])

If you miss this and let the model freestyle, they will absolutely catch hallucinations and mark you down.

---

## 3. Workflow you should be able to describe in the doc / README

For the client review, you should be able to tell a story like:

1. **Upload step**

   * User uploads a PDF or `.txt`.
   * File is stored in Supabase Storage.
   * A background task (Edge Function / API route) extracts text, chunks, embeds, and writes into `document_chunks` with pgvector. ([Medium][2])

2. **Processing state**

   * UI shows a spinner/progress + short explanation:

     * “We’re preparing your document so you can ask questions.”

3. **Chat step**

   * When done, user sees:

     * Document title + maybe page count
     * Chat box “Ask something about this document”
   * For each message:

     * Generate embedding
     * Similarity search restricted to this doc
     * Build context
     * Call model via AI SDK and stream response

4. **Safety behavior**

   * If no relevant context: message clearly says “This doc doesn’t contain that information.”

5. **Multiple documents**

   * Documents page that shows list of uploaded docs
   * Clicking a doc opens its own dedicated chat

That’s the “workflow” they are judging. It matches roughly the architecture of Supabase’s “AI & Vectors” examples and “Chat with Postgres docs” patterns, just applied to user PDFs. ([Supabase][5])

---

## 4. Gaps you still need to think through

You’re on the right general track, but don’t ignore:

* **Chunking quality**
  Naive fixed-length chunking is fine for v1, but at least be aware of this tradeoff. The AI SDK / Supabase guides mention splitting text into semantically meaningful pieces. ([Supabase][5])

* **PDF text extraction**

  * How do you handle scanned PDFs or weird layouts?
  * For the assignment, having a sane library choice + mention of limitations is enough.

* **Auth & privacy story**

  * Client will like hearing “each document is tied to user id; RLS ensures no cross-access”.

* **Latency and background processing**

  * For large PDFs, you don’t want to block an HTTP request.
  * Mention using Supabase Edge Functions or a simple job queue for ingestion. ([Supabase][5])

If you can articulate those in your doc, you’ll look like you understand the tradeoffs, not just copy pasted a tutorial.

---

## 5. Verdict

* Tech choice: ✅ very sane (Next.js + AI SDK + Supabase + OpenAI matches current best practices).
* RAG design: ✅ your idea of per-document vectors and strict retrieval is exactly what “chat with your files” setups do in production. ([GitHub][3])
* UX / workflow: **this is where you’ll be judged**, so tighten:

  * upload → processing → chat with this doc
  * explicit active document
  * clear behavior when answer is not in the doc

So yes, you’re on the right path. Just don’t treat this as “embed & query” only; treat it as a polished “chat with my document” product where the happy path and the failure states are both well designed.

[1]: https://ai-sdk.dev/cookbook/guides/rag-chatbot?utm_source=chatgpt.com "Cookbook: RAG Agent"
[2]: https://medium.com/%40olliedoesdev/create-a-rag-application-using-next-js-supabase-and-openais-text-embedding-3-small-model-7f290c028766?utm_source=chatgpt.com "Create a RAG application using Next.JS, Supabase and ..."
[3]: https://github.com/supabase-community/chatgpt-your-files?utm_source=chatgpt.com "supabase-community/chatgpt-your-files"
[4]: https://vercel.com/templates/next.js/ai-sdk-rag?utm_source=chatgpt.com "RAG with Vercel AI SDK"
[5]: https://supabase.com/docs/guides/ai?utm_source=chatgpt.com "AI & Vectors | Supabase Docs"
