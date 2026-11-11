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
    message = "この端末に削除に必要な情報がありません。";
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
    <p>公開済みの問題・正解は変更できません。</p>
    <Share
      quizId={data.id}
      text={`${data.characterName}のこと、どのくらいしってる？`}
    />
  </section>
  <section class="card">
    <h2>回答者一覧 <small>{data.total}人</small></h2>
    <p>
      <small
        >削除すると、その回答の結果URLも無効になり統計が更新されます。</small
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
  <button type="button" class="danger full" onclick={() => confirm()}>
    クイズ全体を削除
  </button>
{/if}
<dialog bind:this={confirmDialog} class="card" aria-labelledby="delete-title">
  <h2 id="delete-title">
    {target ? "この回答者を削除しますか？" : "クイズ全体を削除しますか？"}
  </h2>
  <p>
    削除は取り消せません。{target
      ? "回答内容と結果が削除されます。"
      : "すべての回答も削除されます。"}
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
