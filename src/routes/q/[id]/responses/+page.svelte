<script lang="ts">
import Metadata from "#lib/components/Metadata.svelte";
import { base } from "#lib/paths";

let { data } = $props();
</script>
<svelte:head
  ><title>回答者一覧 | ひかいど</title>
  <meta name="robots" content="noindex"></svelte:head
>
<Metadata
  title={`${data.quiz.characterName}の回答者一覧 | ひかいど`}
  path={`/q/${data.quiz.id}/responses`}
  image={`/og/quiz/${data.quiz.id}`}
/>
<span class="eyebrow">FRIENDS' RESULTS</span>
<h1>{data.quiz.characterName}の回答者一覧</h1>
<p class="muted">
  全{data.page.total}人 ·
  新しく答えた人から並んでいます。どの答えを選んだかは、ここには載りません。
</p>
<section class="card">
  <ul class="list">
    {#each data.page.items as r}
      <li>
        <div class="row between">
          <strong>{r.name}</strong
          ><span
            >{r.correctCount}/{data.quiz.questionCount}問 ·
            {Math.round(
              (r.correctCount / data.quiz.questionCount) * 100,
            )}%</span
          >
        </div>
        <div class="row between">
          <small
            >{new Date(r.createdAt).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })}</small
          ><a
            href={`${base}/report?quiz=${data.quiz.id}&type=response&target=${r.id}`}
            ><small>名前を通報</small></a
          >
        </div>
      </li>
    {:else}
      <li>まだ回答がありません。最初の挑戦者になろう！</li>
    {/each}
  </ul>
  {#if data.page.nextCursor}
    <a
      class="button full"
      href={`?cursor=${encodeURIComponent(data.page.nextCursor)}`}
      >次の32件</a
    >
  {/if}
</section>
<a class="button primary full" href={`${base}/q/${data.quiz.id}`}>クイズへ</a>
