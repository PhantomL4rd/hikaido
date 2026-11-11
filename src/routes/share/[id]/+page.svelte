<script lang="ts">
import Icon from "#lib/components/Icon.svelte";
import Metadata from "#lib/components/Metadata.svelte";
import { base } from "#lib/paths";

let { data } = $props();
const title = $derived(
  `${data.shared.characterName}への理解度は${data.shared.score}%でした！ | ひかいど`,
);
</script>
<svelte:head
  ><title>{title}</title>
  <meta name="robots" content="noindex"></svelte:head
>
<Metadata
  {title}
  description={`${data.shared.questionCount}問中${data.shared.correctCount}問一致！ あなたはどのくらいしってる？`}
  path={`/share/${data.shared.id}`}
  image={`/og/result/${data.shared.id}`}
/>
<section class="hero">
  <h1>{data.shared.characterName}への理解度は…</h1>
  <div class="score">{data.shared.score}<small>%</small></div>
  <p>{data.shared.questionCount}問中 {data.shared.correctCount}問一致！</p>
  <div class="actions">
    <a class="button primary" href={`${base}/q/${data.shared.quizId}`}
      >あなたも挑戦する<Icon name="ArrowRight" size={16} /></a
    ><a class="button" href={`${base}/create`}>あなたのクイズを作る</a>
  </div>
</section>
