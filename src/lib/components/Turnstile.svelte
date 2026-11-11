<script lang="ts">
import { onMount } from "svelte";

let {
  sitekey,
  action,
  token = $bindable(""),
  resetKey = 0,
}: {
  sitekey: string;
  action: string;
  token?: string;
  resetKey?: number;
} = $props();
let host: HTMLDivElement;
let widget: string | undefined;
type TurnstileAPI = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
function service() {
  return (window as Window & { turnstile?: TurnstileAPI }).turnstile;
}
onMount(() => {
  if (!sitekey) return;
  let stopped = false;
  const render = () => {
    if (!stopped && service() && widget === undefined)
      widget = service()!.render(host, {
        sitekey,
        action,
        callback: (value: string) => (token = value),
        "expired-callback": () => (token = ""),
        "error-callback": () => (token = ""),
      });
  };
  let script = document.querySelector<HTMLScriptElement>("#turnstile-script");
  if (!script) {
    script = document.createElement("script");
    script.id = "turnstile-script";
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    document.head.append(script);
  }
  script.addEventListener("load", render);
  render();
  return () => {
    stopped = true;
    script?.removeEventListener("load", render);
    if (widget !== undefined) service()?.remove(widget);
  };
});
$effect(() => {
  if (resetKey && widget !== undefined) {
    token = "";
    service()?.reset(widget);
  }
});
</script>
<div bind:this={host}></div>
