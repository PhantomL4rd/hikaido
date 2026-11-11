<script lang="ts">
import { onMount } from "svelte";
import { fade } from "svelte/transition";
import { api, load } from "#lib/client";
import Icon from "#lib/components/Icon.svelte";
import Metadata from "#lib/components/Metadata.svelte";
import Share from "#lib/components/Share.svelte";
import { types } from "#lib/domain";
import { base } from "#lib/paths";
import type { result } from "#lib/server/service";
import { page } from "$app/state";

type Result = Awaited<ReturnType<typeof result>>;
let data = $state<Result | null>(null),
  message = $state(""),
  reduced = $state(true),
  accessToken = $state(""),
  sharePath = $state(""),
  sharing = $state(false);
onMount(async () => {
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saved = load<{ resultToken: string } | null>(
    `hikaido-answer-${page.params.id}`,
    null,
  );
  if (!saved) {
    message = "この端末に結果の閲覧情報がありません。";
    return;
  }
  accessToken = saved.resultToken;
  try {
    data = await api<Result>(
      `quizzes/${page.params.id}/result/${page.params.rid}`,
      "GET",
      undefined,
      saved.resultToken,
    );
  } catch (e) {
    message = (e as Error).message;
  }
});
async function createShare() {
  sharing = true;
  try {
    const shared = await api<{ id: string }>(
      `quizzes/${page.params.id}/result/${page.params.rid}/share`,
      "POST",
      {},
      accessToken,
    );
    sharePath = `/share/${shared.id}`;
  } catch (e) {
    message = (e as Error).message;
  } finally {
    sharing = false;
  }
}
const type = $derived(types.find((t) => t.id === data?.type));
</script>
<svelte:head
  ><title>理解度の結果 | ひかいど</title>
  <meta name="robots" content="noindex"></svelte:head
>
<Metadata title="理解度の結果 | ひかいど" path={`/q/${page.params.id}`} />
{#if data}
  <section class="hero" in:fade={{ duration: reduced ? 0 : 180 }}>
    <span class="eyebrow">YOUR RESULT</span>
    <h1>{data.quiz.characterName}への理解度は…</h1>
    <div class="score">
      {Math.round(
        (data.response.correctCount / data.quiz.questionCount) * 100,
      )}<small>%</small>
    </div>
    <p>
      {data.response.name}さん · {data.quiz.questionCount}問中
      {data.response.correctCount}問一致！
    </p>
    <p>
      <small
        >結果を共有すると、出題者名と得点が公開されます。各問題への回答は公開しません。</small
      >
    </p>
    {#if sharePath}
      <Share
        quizId={data.quiz.id}
        path={sharePath}
        text={`${data.quiz.characterName}への理解度は${Math.round((data.response.correctCount / data.quiz.questionCount) * 100)}%でした！`}
      />
    {:else}
      <button
        type="button"
        class="primary"
        disabled={sharing}
        onclick={createShare}
      >
        <Icon name="Share2" size={18} />結果を共有
      </button>
    {/if}
    {#if message}
      <p class="error" role="alert">{message}</p>
    {/if}
  </section>
  {#if type}
    <section
      class="card type"
      style:border-color={type.color}
      in:fade={{ duration: reduced ? 0 : 180 }}
    >
      <div class="type-icon"><Icon name={type.icon} size={48} /></div>
      <p>{data.quiz.characterName}のヒカセンタイプ</p>
      <h2>{type.name}</h2>
      <p>{type.description}</p>
      <small>出題者本人の回答から判定した、娯楽目的の診断です。</small>
    </section>
  {/if}
  <section class="card">
    <h2>答え合わせと、みんなの予想</h2>
    {#each data.questions as q, i}
      <article class="result-question">
        <span class="pill"
          >{q.selectedChoice === q.correctChoice ? "一致！" : "不一致"}
          · 正答率 {q.stats.correctRate}%</span
        >
        <h3>{i + 1}. {q.question}</h3>
        <p>
          正解：<strong
            >{q.correctChoice === "A" ? q.choiceA : q.choiceB}</strong
          ><br>あなたの回答：{q.selectedChoice === "A" ? q.choiceA : q.choiceB}
        </p>
        <div class="row between">
          <span>A · {q.choiceA}</span
          ><small>{q.stats.a}人 · {q.stats.percentA}%</small>
        </div>
        <div class="bar" role="img" aria-label={`A ${q.stats.percentA}%`}>
          <span style={`width:${q.stats.percentA}%`}></span>
        </div>
        <div class="row between">
          <span>B · {q.choiceB}</span
          ><small>{q.stats.b}人 · {q.stats.percentB}%</small>
        </div>
        <div class="bar b" role="img" aria-label={`B ${q.stats.percentB}%`}>
          <span style={`width:${q.stats.percentB}%`}></span>
        </div>
        <small
          >あなたの選択：{q.stats.a === q.stats.b
            ? "同数"
            : (q.selectedChoice === "A" ? q.stats.a : q.stats.b) >
                q.stats.total / 2
              ? "多数派"
              : "少数派"}
          · 有効回答 {q.stats.total}人</small
        >
      </article>
    {/each}
  </section>
  <div class="actions">
    <a class="button" href={`${base}/q/${data.quiz.id}/responses`}
      >回答者一覧を見る</a
    ><a class="button primary" href={`${base}/create`}
      >私も作る <Icon name="ArrowRight" size={16} /></a
    >
  </div>
{:else if message}
  <p class="error" role="alert">{message}</p>
{:else}
  <p role="status">結果を読み込んでいます…</p>
{/if}
