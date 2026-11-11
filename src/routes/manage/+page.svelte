<script lang="ts">
import { onMount } from "svelte";
import { load, type Owned } from "#lib/client";
import { base } from "#lib/paths";

let owned = $state<Owned[]>([]);
onMount(() => {
  owned = load("hikaido-owned", []);
});
</script>
<svelte:head
  ><title>作ったクイズ | ひかいど</title>
  <meta name="robots" content="noindex"></svelte:head
>
<h1>この端末で作ったクイズ</h1>
<p class="muted">
  あとからクイズを削除できるように、このブラウザに情報を保存しています。ブラウザのデータを消すと削除できなくなるので、そのまま残しておいてね。
</p>
{#each owned as q}
  <section class="card">
    <h2>{q.name}の理解度チェック</h2>
    <div class="actions">
      <a class="button primary" href={`${base}/manage/${q.id}`}>回答を確認</a
      ><a class="button" href={`${base}/q/${q.id}`}>クイズを見る</a>
    </div>
  </section>
{:else}
  <section class="card">
    <p>まだクイズがありません。</p>
    <a class="button primary" href={`${base}/create`}>クイズを作る</a>
  </section>
{/each}
