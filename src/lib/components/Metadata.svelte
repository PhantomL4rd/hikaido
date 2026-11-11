<script lang="ts">
import { buildMetadata } from "#lib/metadata";

let {
  title,
  description,
  path = "/",
  image = "/og-default.png",
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
} = $props();
const meta = $derived(buildMetadata({ title, description, path, image }));
</script>
<svelte:head>
  <meta name="description" content={meta.description}>
  <link rel="canonical" href={meta.url}>
  <meta property="og:site_name" content="ひかいど">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:type" content="website">
  <meta property="og:title" content={meta.title}>
  <meta property="og:description" content={meta.description}>
  <meta property="og:url" content={meta.url}>
  <meta property="og:image" content={meta.image}>
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content={meta.title}>
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={meta.title}>
  <meta name="twitter:description" content={meta.description}>
  <meta name="twitter:image" content={meta.image}>
  <meta name="twitter:image:alt" content={meta.title}>
</svelte:head>
