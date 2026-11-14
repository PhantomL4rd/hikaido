<script lang="ts">
import "../app.css";
import { ModeWatcher, resetMode } from "mode-watcher";
import { onMount } from "svelte";
import Brand from "#lib/components/Brand.svelte";
import Icon from "#lib/components/Icon.svelte";
import Metadata from "#lib/components/Metadata.svelte";
import { base } from "#lib/paths";
import { page } from "$app/state";

const navigation = [
  ["/", "ホーム", "House"],
  ["/create", "クイズを作る", "Plus"],
  ["/manage", "作ったクイズ", "List"],
  ["/about", "このサイトについて", "Info"],
] as const;
let { children } = $props();
let drawer: HTMLDialogElement;
let ready = $state(false);
onMount(() => {
  resetMode();
  ready = true;
});
</script>
<ModeWatcher
  modeStorageKey="hikaido-theme"
  lightClassNames={["light"]}
  themeColors={{ light: "#eff1f5", dark: "#24273a" }}
/>
<svelte:head>
  <link rel="icon" href={`${base}/favicon.ico`} sizes="any">
  <link rel="icon" href={`${base}/favicon.svg`} type="image/svg+xml">
  <link
    rel="apple-touch-icon"
    href={`${base}/apple-touch-icon.png`}
  ></svelte:head
>
{#if !page.url.pathname.startsWith(`${base}/q/`) &&
  !page.url.pathname.startsWith(`${base}/share/`)}
  <Metadata path={page.url.pathname.slice(base.length) || "/"} />
{/if}
<header>
  <div class="header-inner">
    <a class="home-link" href={`${base}/`}><Brand /></a>
    <div class="row">
      <button
        type="button"
        class="menu-button"
        onclick={() => drawer.showModal()}
        aria-label="メニューを開く"
        disabled={!ready}
      >
        <Icon name="Menu" strokeWidth={2} />
      </button>
    </div>
  </div>
</header>
<dialog
  bind:this={drawer}
  class="drawer"
  onclick={(e) => {
    if (e.target !== drawer) return;
    const rect = drawer.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
      drawer.close();
  }}
  onkeydown={(e) => {
    if (e.key === "Escape") drawer.close();
  }}
  aria-label="メニュー"
>
  <div class="drawer-header">
    <strong>メニュー</strong
    ><button
      type="button"
      class="menu-button"
      onclick={() => drawer.close()}
      aria-label="メニューを閉じる"
    >
      <Icon name="X" strokeWidth={2} />
    </button>
  </div>
  <nav aria-label="サイトナビゲーション">
    {#each navigation as [path, label, icon]}
      <a
        href={`${base}${path}`}
        onclick={() => drawer.close()}
        aria-current={page.url.pathname === `${base}${path}`
          ? "page"
          : undefined}
        ><Icon name={icon} strokeWidth={2} />{label}</a
      >
    {/each}
    <p class="drawer-section-label">外部リンク</p>
    <a
      href="https://pl4rd.com/"
      target="_blank"
      rel="noopener noreferrer"
      onclick={() => drawer.close()}
      ><Icon name="House" strokeWidth={2} />ホーム</a
    >
    <a
      href="https://pl4rd.com/privacy"
      target="_blank"
      rel="noopener noreferrer"
      onclick={() => drawer.close()}
      ><Icon name="VenetianMask" strokeWidth={2} />プライバシーポリシー</a
    >
    <a
      href="https://contact.pl4rd.com/?service=hikaido"
      target="_blank"
      rel="noopener noreferrer"
      onclick={() => drawer.close()}
      ><Icon name="MessageCircle" strokeWidth={2} />お問い合わせ</a
    >
  </nav>
</dialog>
<main>{@render children()}</main>
<footer>
  <p>HIKAIDO · FINAL FANTASY XIV 非公式ファンサービス</p>
  <p>
    着想元：<a href="https://rikaido.me/" target="_blank" rel="noreferrer"
      >リカイド</a
    >
  </p>
</footer>
