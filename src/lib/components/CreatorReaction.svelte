<script lang="ts">
import { api } from "#lib/client";
import type { Choice } from "#lib/domain";

let { templateId, choice }: { templateId: string; choice?: Choice } = $props();
let message = $state("");
$effect(() => {
  const id = templateId;
  const selected = choice;
  let cancelled = false;
  message = "";
  if (selected) {
    void api<{ reaction: string }>("creator-reaction", "POST", {
      templateId: id,
      choice: selected,
    })
      .then((result) => {
        if (!cancelled) message = result.reaction;
      })
      .catch(() => {
        if (!cancelled)
          message = "回答の傾向を読み込めませんでした。そのまま続けてね。";
      });
  }
  return () => {
    cancelled = true;
  };
});
</script>

<p class="reaction" aria-live="polite">{message}</p>
{#if choice}
  <p class="text-center">
    <small
      >同じ問題で、ほかの出題者が選んだ答えの傾向です。公開されたクイズを集計しています。</small
    >
  </p>
{/if}
