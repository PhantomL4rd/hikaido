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
  クイズを削除するための情報は、このブラウザに保存されています。ブラウザのデータを消すと、あとからクイズを削除できなくなるのでご注意ください。
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
