<script lang="ts">
import { onMount } from "svelte";
import { api, load, type Owned, save } from "#lib/client";
import Share from "#lib/components/Share.svelte";
import { base } from "#lib/paths";
import type { manage } from "#lib/server/service";
import { goto } from "$app/navigation";
import { page } from "$app/state";

type Managed = Awaited<ReturnType<typeof manage>>;
let data = $state<Managed | null>(null),
  message = $state(""),
  owned = $state<Owned | undefined>(),
  cursor = $state(""),
  confirmDialog: HTMLDialogElement,
  target = $state<string | undefined>(),
  busy = $state(false);
async function refresh() {
  try {
    data = await api<Managed>(
      `quizzes/${page.params.id}/manage${cursor ? "?cursor=" + encodeURIComponent(cursor) : ""}`,
      "GET",
      undefined,
      owned?.token,
    );
  } catch (e) {
    message = (e as Error).message;
  }
}
onMount(() => {
  owned = load<Owned[]>("hikaido-owned", []).find(
    (q) => q.id === page.params.id,
  );
  if (!owned) {
    message =
      "このブラウザには、クイズを開くための情報が見つかりませんでした。作ったときのブラウザで開いてみてね。";
    return;
  }
  void refresh();
});
function confirm(id?: string) {
  target = id;
  confirmDialog.showModal();
}
async function remove() {
  busy = true;
  try {
    await api(
      `quizzes/${page.params.id}${target ? "/responses/" + target : ""}`,
      "DELETE",
      undefined,
      owned?.token,
    );
    confirmDialog.close();
    if (!target) {
      save(
        "hikaido-owned",
        load<Owned[]>("hikaido-owned", []).filter(
          (q) => q.id !== page.params.id,
        ),
      );
      await goto(`${base}/manage`);
    } else await refresh();
  } catch (e) {
    message = (e as Error).message;
  } finally {
    busy = false;
  }
}
</script>
<svelte:head
  ><title>作ったクイズ | ひかいど</title>
  <meta name="robots" content="noindex"></svelte:head
>
{#if data}
  <h1>{data.characterName}の作ったクイズ</h1>
  <section class="card">
    <p>
      公開した問題と答えは、あとから変更できません。新しく作りたいときは「クイズを作る」からどうぞ。
    </p>
    <Share
      quizId={data.id}
      text={`${data.characterName}のこと、どのくらいしってる？`}
    />
  </section>
  <section class="card">
    <h2>回答者一覧 <small>{data.total}人</small></h2>
    <p>
      <small
        >回答を削除すると、その人の結果ページも見られなくなります。みんなの回答の集計からも外れます。</small
      >
    </p>
    <ul class="list">
      {#each data.items as r}
        <li>
          <div class="row between">
            <strong>{r.name}</strong
            ><span
              >{r.correctCount}/{data.questionCount}問 ·
              {Math.round((r.correctCount / data.questionCount) * 100)}%</span
            >
          </div>
          <div class="row between">
            <small>{new Date(r.createdAt).toLocaleString("ja-JP")}</small
            ><button type="button" class="danger" onclick={() => confirm(r.id)}>
              回答者を削除
            </button>
          </div>
        </li>
      {:else}
        <li>まだ回答がありません。</li>
      {/each}
    </ul>
    {#if data.nextCursor}
      <button
        type="button"
        class="full"
        onclick={() => {
          cursor = data!.nextCursor!;
          void refresh();
        }}
      >
        次の32件
      </button>
    {/if}
  </section>
  <details class="card">
    <summary>みんなはどのくらい正解した？</summary>
    <p class="muted">
      これまでに届いたフレンドのこたえをまとめたよ。削除したこたえは入っていません。
    </p>
    <!-- biome-ignore lint/a11y/noRedundantRoles: list-styleなしでもSafariにリストとして伝えるため -->
    <ol class="list" role="list">
      {#each data.questionStats as q, i (q.id)}
        <li>
          <h3>第{i + 1}問：{q.question}</h3>
          <p>あなたの答え：{q.answer}</p>
          {#if q.correctRate === null}
            <p class="muted">まだ回答がありません。</p>
          {:else}
            <p>
              <strong>正答率 {q.correctRate}%</strong>
              · {q.total}人中{q.correctCount}人が正解
            </p>
          {/if}
        </li>
      {/each}
    </ol>
  </details>
  <button type="button" class="danger full" onclick={() => confirm()}>
    クイズ全体を削除
  </button>
{/if}
<dialog bind:this={confirmDialog} class="card" aria-labelledby="delete-title">
  <h2 id="delete-title">
    {target ? "この回答者を削除しますか？" : "クイズ全体を削除しますか？"}
  </h2>
  <p>
    一度消すと元には戻せません。{target
      ? "この人の回答と結果を削除します。"
      : "このクイズに届いた回答もすべて削除します。"}
  </p>
  <div class="actions">
    <button type="button" disabled={busy} onclick={() => confirmDialog.close()}>
      キャンセル
    </button><button
      type="button"
      class="danger"
      disabled={busy}
      onclick={remove}
    >
      削除する
    </button>
  </div>
</dialog>
{#if message}
  <p role="alert" class="error">{message}</p>
{/if}

<style>
summary {
  cursor: pointer;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.5;
}
</style>
