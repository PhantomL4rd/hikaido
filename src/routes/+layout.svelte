<script lang="ts">
import "../app.css";
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
  ["/contact", "お問い合わせ", "Mail"],
] as const;
let { children } = $props();
let drawer: HTMLDialogElement;
let dark = $state(false);
let ready = $state(false);
onMount(() => {
  ready = true;
  dark =
    localStorage.getItem("hikaido-theme") === "dark" ||
    (!localStorage.getItem("hikaido-theme") &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
});
function theme() {
  dark = !dark;
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("hikaido-theme", dark ? "dark" : "light");
}
</script>
<svelte:head
  ><meta name="theme-color" content="#eff1f5">
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
<div class="notice">FFXIVファンによる非公式サービス · 無料・ログイン不要</div>
<header>
  <div class="header-inner">
    <a class="home-link" href={`${base}/`}><Brand /></a>
    <div class="row">
      <button
        type="button"
        class="icon-button"
        onclick={theme}
        aria-label="配色を切り替える"
        disabled={!ready}
      >
        <Icon name={dark ? "Sun" : "Moon"} />
      </button><button
        type="button"
        class="icon-button"
        onclick={() => drawer.showModal()}
        aria-label="メニューを開く"
        disabled={!ready}
      >
        <Icon name="Menu" size={22} />
      </button>
    </div>
  </div>
</header>
<dialog
  bind:this={drawer}
  class="drawer"
  onclick={(e) => {
    if (e.target === drawer) drawer.close();
  }}
  onkeydown={(e) => {
    if (e.key === "Escape") drawer.close();
  }}
  aria-label="メニュー"
>
  <div class="row between">
    <strong>メニュー</strong
    ><button
      type="button"
      class="icon-button"
      onclick={() => drawer.close()}
      aria-label="メニューを閉じる"
    >
      <Icon name="X" />
    </button>
  </div>
  <nav>
    {#each navigation as [path, label, icon]}
      <a href={`${base}${path}`} onclick={() => drawer.close()}
        ><Icon name={icon} />{label}</a
      >
    {/each}
    <hr>
    <small>リンク</small
    ><a href="https://pl4rd.com/" target="_blank" rel="noreferrer"
      ><Icon name="House" />ホーム<Icon name="ExternalLink" size={14} /></a
    ><a href="https://pl4rd.com/privacy" target="_blank" rel="noreferrer"
      ><Icon name="Shield" />プライバシーポリシー<Icon
        name="ExternalLink"
        size={14}
      /></a
    >
  </nav>
</dialog>
<main>{@render children()}</main>
<footer>
  <a href={`${base}/about`}>このサイトについて</a><span> · </span
  ><a href={`${base}/contact`}>お問い合わせ</a>
  <p>HIKAIDO · FINAL FANTASY XIV 非公式ファンサービス</p>
  <p>
    着想元：<a href="https://rikaido.me/" target="_blank" rel="noreferrer"
      >リカイド</a
    >
  </p>
</footer>
