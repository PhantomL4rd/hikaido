<script lang="ts">
import Icon from "#lib/components/Icon.svelte";
import { base } from "#lib/paths";
</script>
<svelte:head
  ><title>ひかいど | ヒカセンの2択理解度チェック</title>
</svelte:head>
<section class="hero">
  <h1>あのヒカセンのこと、<br>どのくらいしってる？</h1>
  <p>「このヒカセンなら、どっち？」<br>2択で見つかる、あなたの意外な一面。</p>
  <a class="button primary" href={`${base}/create`}
    >あなたのクイズを作る <Icon name="ArrowRight" size={16} /></a
  >
  <p><small>無料 · ログイン不要 · 10問から気軽に</small></p>
</section>
<section class="card steps">
  <h2>あそびかた</h2>
  <p>あなたが2択に答えて、クイズを作る</p>
  <p>できたURLを、いつもの仲間へ</p>
  <p>友達が予想！ 何問一致するかな？</p>
</section>
<section class="card">
  <h2>あなたはどんなヒカセン？</h2>
  <p>8つのヒカセンタイプを診断。冒険の楽しみ方が見えてくるかも。</p>
  <small
    >診断・理解度は娯楽目的です。性格や友情を科学的に測るものではありません。</small
  >
</section>
<p class="text-center">
  <a href={`${base}/manage`}>この端末で作ったクイズを見る</a>
</p>
