<script lang="ts">
import { onMount } from "svelte";
import { fade } from "svelte/transition";
import * as v from "valibot";
import { api, copy, load, type Owned, save, secret } from "#lib/client";
import Icon from "#lib/components/Icon.svelte";
import Turnstile from "#lib/components/Turnstile.svelte";
import {
  type Choice,
  type DraftQuestion,
  diagnose,
  makeDraft,
  replaceQuestion,
  types,
} from "#lib/domain";
import { base } from "#lib/paths";
import { nameSchema } from "#lib/validation";

let { data } = $props();
let name = $state(""),
  count = $state<10 | 25>(10),
  draft = $state<DraftQuestion[]>([]),
  position = $state(0),
  stage = $state("setup"),
  message = $state(""),
  busy = $state(false),
  token = $state(""),
  reset = $state(0),
  published = $state(""),
  reduced = $state(true),
  ready = $state(false);
onMount(() => {
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const d = load<{
    name: string;
    count: 10 | 25;
    draft: DraftQuestion[];
    position: number;
    stage: string;
  } | null>("hikaido-draft", null);
  if (d) {
    name = d.name;
    count = d.count;
    draft = d.draft;
    position = d.position;
    stage = d.stage;
  }
  ready = true;
});
$effect(() => {
  if (ready && stage !== "published")
    save("hikaido-draft", { name, count, draft, position, stage });
});
const current = $derived(draft[position]);
const type = $derived(
  draft.length && draft.every((q) => q.answer)
    ? types.find(
        (t) =>
          t.id === diagnose(draft.map((q) => ({ ...q, answer: q.answer! }))),
      )
    : undefined,
);
function start() {
  const n = v.safeParse(nameSchema, name);
  if (!n.success) {
    message = n.issues[0].message;
    return;
  }
  name = n.output;
  message = "";
  draft = makeDraft(count);
  position = 0;
  stage = "questions";
}
function select(choice: Choice) {
  draft[position].answer = choice;
}
async function publish() {
  busy = true;
  message = "";
  try {
    const managementToken = secret();
    const owned = load<Owned[]>("hikaido-owned", []);
    save("hikaido-pending-owner", { token: managementToken, name });
    const r = await api<{ id: string }>("quizzes", "POST", {
      characterName: name,
      questions: draft.map((q) => ({ templateId: q.id, answer: q.answer })),
      managementToken,
      turnstile: token,
    });
    save("hikaido-owned", [
      ...owned,
      { id: r.id, name, token: managementToken },
    ]);
    localStorage.removeItem("hikaido-draft");
    localStorage.removeItem("hikaido-pending-owner");
    published = r.id;
    stage = "published";
  } catch (e) {
    message = (e as Error).message;
  } finally {
    busy = false;
    reset++;
  }
}
function url() {
  return `${location.origin}${base}/q/${published}`;
}
</script>
<svelte:head
  ><title>クイズを作る | ひかいど</title>
  <meta name="robots" content="noindex"></svelte:head
>
{#if stage === "setup"}
  <span class="eyebrow">CREATE YOUR QUIZ</span>
  <h1>まずは、あなたのこと。</h1>
  <p class="muted">いつものキャラクター名で、仲間に届けよう。</p>
  <form
    class="card"
    onsubmit={(e) => {
      e.preventDefault();
      start();
    }}
  >
    <label for="name">キャラクター名</label>
    <input
      id="name"
      disabled={!ready}
      maxlength="30"
      bind:value={name}
      placeholder="例：ひろし"
      required
    ><label for="count">問題数</label
    ><select id="count" bind:value={count}>
      <option value={10}>10問 · さくっとコース</option>
      <option value={25}>25問 · じっくりコース</option>
    </select>
    <p>
      <button type="submit" class="primary full">
        2択をはじめる <Icon name="ArrowRight" size={16} />
      </button>
    </p>
  </form>
{:else if stage === "questions" && current}
  <div class="progress-label">
    <span
      >{current.type === "diagnosis"
        ? "ヒカセンタイプ診断 · 固定問題"
        : current.category}</span
    ><span>{position + 1} / {draft.length}</span>
  </div>
  <progress
    value={position + 1}
    max={draft.length}
    aria-label="作成の進捗"
  ></progress>
  {#key current.id}
    <section in:fade={{ duration: reduced ? 0 : 130 }}>
      <h1 class="question">{current.question.replaceAll("{name}", name)}</h1>
      <div class="grid">
        <button
          type="button"
          class="choice"
          aria-pressed={current.answer === "A"}
          onclick={() => select("A")}
        >
          <small>A</small>{current.choiceA}
        </button><button
          type="button"
          class="choice"
          aria-pressed={current.answer === "B"}
          onclick={() => select("B")}
        >
          <small>B</small>{current.choiceB}
        </button>
      </div>
    </section>
  {/key}
  {#if current.type === "normal"}
    <p class="text-center">
      <button
        type="button"
        class="reroll-button"
        onclick={() => {
          const next = replaceQuestion(draft, position);
          message =
            next === draft ? "別の問題の候補をすべて使っています。" : "";
          draft = next;
        }}
      >
        <Icon name="RefreshCw" size={14} />べつの問題にする
      </button>
    </p>
  {/if}
  <div class="actions">
    <button
      type="button"
      onclick={() => {
        if (position > 0) position--;
        else stage = "setup";
      }}
    >
      <Icon name="ArrowLeft" size={16} />もどる
    </button><button
      type="button"
      class="primary"
      disabled={!current.answer}
      onclick={() => {
        if (position < draft.length - 1) position++;
        else stage = "review";
      }}
    >
      {position === draft.length - 1 ? "内容を確認する" : "つぎへ"}
    </button>
  </div>
{:else if stage === "review"}
  <h1>これが、あなたの2択。</h1>
  {#if type}
    <section class="card type" in:fade={{ duration: reduced ? 0 : 180 }}>
      <span class="type-icon"><Icon name={type.icon} size={48} /></span>
      <p>{name}のヒカセンタイプ</p>
      <h2>{type.name}</h2>
      <p>{type.description}</p>
      <small>娯楽目的の診断です。</small>
    </section>
  {/if}
  <section class="card">
    <h2>公開前の確認</h2>
    <ul class="list">
      {#each draft as q, i}
        <li>
          <strong>{i + 1}. {q.question.replaceAll("{name}", name)}</strong>
          <div class="row between">
            <span>{q.answer === "A" ? q.choiceA : q.choiceB}</span
            ><button
              type="button"
              onclick={() => {
                position = i;
                stage = "questions";
              }}
            >
              変更
            </button>
          </div>
        </li>
      {/each}
    </ul>
    <p>
      公開後は問題と正解を変更できません。URLを知る人は誰でもアクセスできます。
    </p>
    <p>
      <small
        >削除に必要な情報はこの端末に保存されます。ブラウザのデータを削除すると復旧できません。</small
      >
    </p>
    <Turnstile
      sitekey={data.sitekey}
      action="publish"
      bind:token
      resetKey={reset}
    /><button
      type="button"
      class="primary full"
      disabled={busy}
      onclick={publish}
    >
      {busy ? "公開しています…" : "この内容で公開する"}
    </button>
  </section>
{:else if stage === "published"}
  <section class="hero">
    <span class="type-icon"><Icon name="Heart" size={48} /></span>
    <h1>クイズができました！</h1>
    <p>いつもの仲間に、あなたの2択を。</p>
    <div class="card">
      <p class="share-url">{typeof location !== "undefined" ? url() : ""}</p>
      <button
        type="button"
        class="primary"
        onclick={async () => {
          try {
            await copy(url());
            message = "URLをコピーしました";
          } catch {
            message = "上のURLを選択してコピーしてください";
          }
        }}
      >
        URLをコピー
      </button>
      <div class="actions">
        <a class="button" href={`${base}/q/${published}`}>クイズを見る</a
        ><a class="button" href={`${base}/manage/${published}`}>回答を確認</a>
      </div>
    </div>
  </section>
{/if}
{#if message}
  <p role="status" class={stage === "published" ? "success" : "error"}>
    {message}
  </p>
{/if}
