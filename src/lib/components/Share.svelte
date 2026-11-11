<script lang="ts">
import { copy } from "#lib/client";
import Icon from "#lib/components/Icon.svelte";
import { base } from "#lib/paths";
import { page } from "$app/state";

let { quizId, text, path }: { quizId: string; text: string; path?: string } =
  $props();
let message = $state("");
const url = $derived(`${page.url.origin}${base}${path || `/q/${quizId}`}`);
async function share() {
  try {
    if (navigator.share)
      await navigator.share({ title: "ひかいど", text, url });
    else {
      await copy(url);
      message = "URLをコピーしました";
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError")
      message =
        "うまく共有できませんでした。URLをコピーして、仲間に送ってみてね。";
  }
}
</script>
<div class="actions">
  <button
    type="button"
    onclick={async () => {
      try {
        await copy(url);
        message = "URLをコピーしました";
      } catch {
        message = url;
      }
    }}
  >
    <Icon name="Copy" size={16} />URLコピー
  </button><button type="button" onclick={share}>
    <Icon name="Share2" size={16} />共有
  </button><a
    class="button"
    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + " #ひかいど")}&url=${encodeURIComponent(url)}`}
    target="_blank"
    rel="noreferrer"
    >Xで共有<Icon name="ExternalLink" size={14} /></a
  >
</div>
{#if message}
  <p class="success" role="status">{message}</p>
{/if}
