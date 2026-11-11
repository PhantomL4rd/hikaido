<script lang="ts">
import { onMount } from "svelte";
import { fade } from "svelte/transition";
import * as v from "valibot";
import { api, load, save, secret } from "#lib/client";
import Icon from "#lib/components/Icon.svelte";
import Metadata from "#lib/components/Metadata.svelte";
import Turnstile from "#lib/components/Turnstile.svelte";
import type { Choice } from "#lib/domain";
import { base } from "#lib/paths";
import { nameSchema } from "#lib/validation";
import { goto } from "$app/navigation";

let { data } = $props();
let name = $state(""),
  started = $state(false),
  position = $state(0),
  answers = $state<Record<string, Choice>>({}),
  busy = $state(false),
  message = $state(""),
  answerPermit = $state(""),
  token = $state(""),
  reset = $state(0),
  idempotencyKey = $state(""),
  resultToken = $state(""),
  existing = $state(""),
  ready = $state(false),
  reduced = $state(true);
const current = $derived(data.quiz.questions[position]);
const key = $derived(`hikaido-answer-${data.quiz.id}`);
onMount(() => {
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const old = load<{
    name: string;
    answers: Record<string, Choice>;
    position: number;
    idempotencyKey: string;
    resultToken: string;
    responseId?: string;
  } | null>(key, null);
  if (old) {
    name = old.name;
    answers = old.answers;
    position = old.position;
    idempotencyKey = old.idempotencyKey;
    resultToken = old.resultToken;
    existing = old.responseId || "";
  } else {
    idempotencyKey = crypto.randomUUID();
    resultToken = secret();
  }
  ready = true;
});
$effect(() => {
  if (ready)
    save(key, {
      name,
      answers,
      position,
      idempotencyKey,
      resultToken,
      responseId: existing,
    });
});
async function start() {
  if (busy) return;
  const r = v.safeParse(nameSchema, name);
  if (!r.success) {
    message = r.issues[0].message;
    return;
  }
  name = r.output;
  message = "";
  busy = true;
  try {
    const entry = await api<{ answerPermit: string }>(
      `quizzes/${data.quiz.id}/answer-entry`,
      "POST",
      { idempotencyKey, resultToken, turnstile: token },
    );
    answerPermit = entry.answerPermit;
    started = true;
  } catch (e) {
    message = (e as Error).message;
  } finally {
    busy = false;
    reset++;
  }
}
function choose(choice: Choice) {
  answers[current.id] = choice;
}
async function submit() {
  if (busy) return;
  busy = true;
  message = "";
  try {
    const r = await api<{ id: string }>(
      `quizzes/${data.quiz.id}/responses`,
      "POST",
      {
        respondentName: name,
        answers: data.quiz.questions.map((q) => ({
          questionId: q.id,
          choice: answers[q.id],
        })),
        idempotencyKey,
        resultToken,
        answerPermit,
      },
    );
    existing = r.id;
    save(key, {
      name,
      answers,
      position,
      idempotencyKey,
      resultToken,
      responseId: r.id,
    });
    await goto(`${base}/q/${data.quiz.id}/result/${r.id}`);
  } catch (e) {
    message = (e as Error).message;
    if (message.includes("入口")) started = false;
  } finally {
    busy = false;
    reset++;
  }
}
</script>
<svelte:head
  ><title>{data.quiz.characterName}理解度チェック | ひかいど</title>
  <meta name="robots" content="noindex"></svelte:head
>
<Metadata
  title={`${data.quiz.characterName}理解度チェック | ひかいど`}
  description={`${data.quiz.characterName}のこと、どのくらいしってる？ ${data.quiz.questionCount}問の2択で理解度をチェック！`}
  path={`/q/${data.quiz.id}`}
  image={`/og/quiz/${data.quiz.id}`}
/>
{#if !started}
  <section class="hero">
    <span class="eyebrow">HOW WELL DO YOU KNOW?</span>
    <h1>{data.quiz.characterName}のこと、<br>どのくらいしってる？</h1>
    <p>{data.quiz.questionCount}問の2択で、本人の答えを予想しよう。</p>
  </section>
  {#if existing}
    <div class="card">
      <p>このブラウザでは、もう答えているみたい。結果を見てみよう！</p>
      <a
        class="button primary full"
        href={`${base}/q/${data.quiz.id}/result/${existing}`}
        >結果を見る</a
      >
    </div>
  {:else}
    <form
      class="card"
      onsubmit={(e) => {
        e.preventDefault();
        start();
      }}
    >
      <label for="respondent">回答者名</label>
      <input
        id="respondent"
        disabled={!ready}
        bind:value={name}
        maxlength="30"
        required
        placeholder="仲間に伝わる名前"
      >
      <p>
        <small
          >答えたあとは、名前・正解数・理解度・答えた日時が回答者一覧に載ります。一覧は誰でも見られるので、公開してもよい名前で遊んでね。</small
        >
      </p>
      <Turnstile
        sitekey={data.sitekey}
        action="answer"
        bind:token
        resetKey={reset}
      />
      <button
        type="submit"
        class="primary full"
        disabled={busy || !ready || (!!data.sitekey && !token)}
      >
        挑戦する <Icon name="ArrowRight" size={16} />
      </button>
    </form>
  {/if}
  <p class="text-center">
    <a href={`${base}/q/${data.quiz.id}/responses`}>回答者一覧を見る</a>
    ·
    <a
      href={`${base}/report?quiz=${data.quiz.id}&type=quiz&target=${data.quiz.id}`}
      >名前を通報</a
    >
  </p>
  <p class="text-center muted">
    <small
      >URLを知っていれば、誰でも遊べます。「理解度」は、本人の答えとどれくらい同じだったかを表しています。</small
    >
  </p>
{:else}
  <div class="progress-label">
    <span>{data.quiz.characterName}なら、どっち？</span
    ><span>{position + 1} / {data.quiz.questionCount}</span>
  </div>
  <progress
    value={position + 1}
    max={data.quiz.questionCount}
    aria-label="回答の進捗"
  ></progress>
  {#key current.id}
    <section in:fade={{ duration: reduced ? 0 : 130 }}>
      <h1 class="question">{current.question}</h1>
      <div class="grid">
        <button
          type="button"
          class="choice"
          disabled={busy}
          aria-pressed={answers[current.id] === "A"}
          onclick={() => choose("A")}
        >
          <small>A</small>{current.choiceA}
        </button><button
          type="button"
          class="choice"
          disabled={busy}
          aria-pressed={answers[current.id] === "B"}
          onclick={() => choose("B")}
        >
          <small>B</small>{current.choiceB}
        </button>
      </div>
    </section>
  {/key}
  <div class="actions">
    <button
      type="button"
      disabled={busy}
      onclick={() => {
        if (position > 0) position--;
        else started = false;
      }}
    >
      <Icon name="ArrowLeft" size={16} />もどる
    </button><button
      type="button"
      class="primary"
      disabled={!answers[current.id] || busy}
      onclick={() => {
        if (position < data.quiz.questionCount - 1) position++;
        else void submit();
      }}
    >
      {position === data.quiz.questionCount - 1
        ? busy
          ? "結果を開いています…"
          : "結果を見る"
        : "つぎへ"}
    </button>
  </div>
{/if}
{#if message}
  <p role="alert" class="error">{message}</p>
{/if}
