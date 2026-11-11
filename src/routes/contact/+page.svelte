<script lang="ts">
import Turnstile from "#lib/components/Turnstile.svelte";

let { data, form } = $props();
</script>
<svelte:head><title>お問い合わせ | ひかいど</title></svelte:head>
<h1>お問い合わせ</h1>
<p class="muted">
  不具合や、もっと遊びやすくするためのアイデアをお寄せください。
</p>
{#if form?.id}
  <section class="card">
    <h2>受け付けました</h2>
    <p>お問い合わせありがとうございます。</p>
    <small>受付ID：{form.id}</small>
  </section>
{:else}
  <form method="POST" class="card">
    <label for="contact-name">名前（任意）</label>
    <input id="contact-name" name="name" maxlength="30" autocomplete="name">
    <label for="email">返信先メールアドレス（任意）</label>
    <input
      id="email"
      name="email"
      type="email"
      maxlength="254"
      autocomplete="email"
    ><label for="category">お問い合わせ種別</label
    ><select id="category" name="category">
      <option>不具合報告</option>
      <option>ご意見・ご要望</option>
      <option>その他</option>
    </select><label for="message">本文（1000文字以内）</label
    ><textarea id="message" name="message" maxlength="1000" required></textarea>
    <p>
      <small
        >名前・メールアドレスは任意です。入力内容は対応と返信のためDBに保存し、運営のSlackへ通知します。返信不要の場合はメールアドレスを入力しないでください。不要となった情報は運営が削除します。</small
      >
    </p>
    <Turnstile sitekey={data.sitekey} action="contact" />
    <button type="submit" class="primary full">送信する</button>
    {#if form?.error}
      <p class="error" role="alert">{form.error}</p>
    {/if}
  </form>
{/if}
