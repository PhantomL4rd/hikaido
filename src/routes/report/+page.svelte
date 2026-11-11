<script lang="ts">
import { api } from "#lib/client";
import Turnstile from "#lib/components/Turnstile.svelte";

let { data } = $props();
let reason = $state("不適切な名前"),
  token = $state(""),
  reset = $state(0),
  message = $state(""),
  done = $state(false),
  busy = $state(false);
async function send() {
  busy = true;
  try {
    await api("reports", "POST", { ...data, reason, turnstile: token });
    done = true;
  } catch (e) {
    message = (e as Error).message;
  } finally {
    busy = false;
    reset++;
  }
}
</script>
<svelte:head
  ><title>名前を通報 | ひかいど</title>
  <meta name="robots" content="noindex"></svelte:head
>
<h1>名前を通報</h1>
{#if done}
  <section class="card">
    <p>通報を受け付けました。運営が確認します。</p>
  </section>
{:else}
  <form
    class="card"
    onsubmit={(e) => {
      e.preventDefault();
      void send();
    }}
  >
    <p>不適切な名前について、運営にお知らせください。</p>
    <label for="reason">通報理由</label
    ><select id="reason" bind:value={reason}>
      <option>不適切な名前</option>
      <option>嫌がらせ</option>
      <option>個人情報</option>
      <option>その他</option>
    </select><Turnstile
      sitekey={data.sitekey}
      action="report"
      bind:token
      resetKey={reset}
    /><button type="submit" class="primary full" disabled={busy}>
      通報する
    </button>
    {#if message}
      <p class="error" role="alert">{message}</p>
    {/if}
  </form>
{/if}
