# ひかいど / HIKAIDO

FF14プレイヤー向けの無料・ログイン不要の2択理解度チェック。自分の答えを正解にした10問または25問のクイズを作り、URLを友達へ共有します。回答後に一致率・問題別統計・出題者のヒカセン8タイプを表示します。

URL: https://pl4rd.com/hikaido · GitHub: [PhantomL4rd/hikaido](https://github.com/PhantomL4rd/hikaido)（public）

## 技術スタック

Svelte 5 Runes / SvelteKit 3 / TypeScript strict / Cloudflare Workers / D1 / Drizzle ORM / Valibot / Biome / Vitest / Playwright / pnpm / Wrangler。UIライブラリ不使用。配色はCatppuccin Latte/Macchiato。ヘッダー・右側メニューはcolorant-picker・4seasonsに合わせています。ヘッダーはLucide Heartと「ひかいど」を表示します。提供ブランド素材はfaviconとOGPに使用します。

SvelteKit 3の設定は `vite.config.ts`、Bindingsは現行の `cloudflare:workers` から取得します。TypeScriptはSvelteKitのpeer dependencyに合わせ6.0.3に固定。Biome 2.6の `html.experimentalFullSupportEnabled` と `html.formatter.enabled` を有効化してSvelte全体を扱い、Svelte固有の検証はsvelte-checkでも行います。

## ディレクトリ

```text
src/lib/templates.ts          運営テンプレート（通常76問＋診断4問）
src/lib/domain.ts             診断・下書き・統計・リアクション
src/lib/validation.ts         共通Valibotスキーマ
src/lib/components/          ロゴ差し替え箇所、共有、Turnstile
src/lib/server/               Drizzleスキーマ、業務処理、権限、Outbox
src/routes/                  SSR画面、Form Actions、API Routes
scripts/admin.ts             運営CLI（公開管理者APIなし）
drizzle/                     D1マイグレーション
tests/                       単体・独立D1統合テスト
tests/e2e/                   ブラウザでの主要導線
docs/spec.md                 保存・公開境界と設計判断
```

## ローカルセットアップ

Node.js 22.12以上（推奨24 LTS）とpnpmが必要です。Cloudflare認証なしでローカルD1を利用できます。

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

http://127.0.0.1:5173/hikaido を開きます。`.dev.vars` の `LOCAL_TEST_MODE=true` はlocalhost/127.0.0.1のときだけTurnstileを省略します。Slack未設定でも通報・お問い合わせはDBとOutboxに保存されます。`.dev.vars` はGit対象外です。リクエスト本文は64KiBまで。

ローカルデータは `.wrangler/state` に保存されます。クイズ削除と回答者削除は取り消せません。下書き、作ったクイズと削除権限、回答済み記録・結果閲覧権限はブラウザのlocalStorageに保存され、他端末への復旧機能はありません。

## D1とマイグレーション

`wrangler.jsonc` のD1 IDはローカル用プレースホルダーです。本番リソース作成は所有者の承認後に行ってください。

```sh
pnpm exec wrangler whoami
pnpm exec wrangler d1 create hikaido
# 返されたdatabase_idをwrangler.jsoncに設定
pnpm types
pnpm db:migrate:local
# 本番DBへの適用は承認・バックアップ確認後
pnpm db:migrate:remote
```

スキーマを変える際は、先に仕様とテストを更新してから `pnpm db:generate`。生成SQLを確認して適用します。`0001_response_guard.sql` は公開状態をDBでも保証する手書きトリガーです。Drizzle batchはトランザクションとして実行され、25問の保存ではD1の変数上限を超えないよう各INSERTを分けています。外部キーCASCADEで回答明細を削除し、通報履歴は独立したスナップショットとして保持します。

## Secrets / Turnstile

Cloudflare DashboardでTurnstileウィジェットを作成し、本番のホストを `pl4rd.com` にします。公開sitekeyを `PUBLIC_TURNSTILE_SITE_KEY` に設定し、`TURNSTILE_HOSTNAME=pl4rd.com`、`LOCAL_TEST_MODE=false` を維持します。サーバー側でsuccess・action・hostnameを照合します。トークンは1回ごとに更新します。

```sh
# 本番へのSecret設定も所有者の承認後。値は対話入力し履歴やGitに残さない
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm exec wrangler secret put SLACK_WEBHOOK_URL
```

開発で実際のTurnstileを試す場合は別のローカル用ウィジェットを作り `.dev.vars` にsitekey・secret・正しいホストを設定し `LOCAL_TEST_MODE=false` にします。未設定の本番では受付を拒否します。

## Slack Incoming Webhook

SlackアプリのIncoming Webhookを有効にし、通知先チャンネルへ追加して発行されたURLをSecretに保存します。URLをソース、引数、ログへ出さないでください。通報・お問い合わせと通知イベントをD1 batchで保存した後に `waitUntil` で送信します。Slack障害時も受付は成功し、未送信イベントを保持します。

```sh
# Webhookを安全に環境へ読み込んだ運営端末で実行
pnpm admin notifications retry          # ローカル
pnpm admin notifications retry --remote # 本番・承認後
```

再送CLIでは `SLACK_WEBHOOK_URL` を運営端末の環境変数に設定してください。20件ずつ処理し、60秒のリース中は再送しません。失敗後は60秒以上待って再実行します。Webhook未設定ならイベントは保持されます。Slack側受理直後のプロセス停止では重複の可能性があります。レート制限はD1で原子的にカウントし、同一IPからの作成は8回/時、回答は60回/時、通報は5回/時、お問い合わせは3回/時、同一対象への通報は1回/時です。リアクションは300回/分。

## テストと品質確認

```sh
pnpm check                 # 必須svelte-check
pnpm lint
pnpm format
pnpm test                  # Vitest・一時的な独立D1を含む（ローカルポートが必要）
pnpm exec playwright install chromium
pnpm db:migrate:local
pnpm test:e2e              # 一時D1を毎回用意。 .dev.varsは上記ローカルテスト設定
pnpm build
```

単体テストは診断全16パターン・8タイプ到達、10/25問、重複防止、差し替え・回答リセット、統計・リアクション境界、入力検証、ハッシュ・Slackエスケープを検証します。D1統合では採点・冪等性・32件カーソル・削除権限・CASCADE・正解秘匿・多数派と正解の分離・削除後統計・通報スナップショット・Outbox失敗と再送を確認します。Playwrightは作成・復元・回答・結果・削除とAPI制御を確認します。本物のSlack・Turnstileの疎通は本番Secret設定後に別途実施してください。

## 運営CLI

既定はローカルD1です。本番操作では末尾に `--remote` を付け、Wranglerが認証した運営者のCloudflare権限を使います。クイズの管理秘密をCLIや一覧へ出力しません。削除・非表示には `yes` の確認が必要です。

```sh
pnpm admin reports list
pnpm admin reports resolve <id>
pnpm admin quiz inspect <id>
pnpm admin quiz hide <id>
pnpm admin quiz delete <id>
pnpm admin response delete <id>
pnpm admin contacts list
pnpm admin contacts inspect <id>
pnpm admin notifications retry
```

リストは最新100件です。非表示のクイズは公開ページ・結果・新規回答からアクセスできません。クイズ全体削除では設問・回答・回答明細も削除されます。通報名の履歴は残ります。お問い合わせの保存目的は返信と対応です。不要となった連絡先・本文は運営がD1で削除してください。

## 本番デプロイ

本番リソース作成とデプロイには事前確認が必要です。GitHubへのpushは利用者から明示的な指示を受けた場合に行います。

承認後、Cloudflare `PhantomL4rd` アカウントを確認し、D1作成・ID差し替え・Secret設定・Turnstile設定・リモートマイグレーションを終えてから実行します。

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
# 内容と対象アカウントを確認した後
pnpm exec wrangler deploy
```

`pl4rd.com` の既存サイトを維持したまま配信するため、本番設定へ `routes: [{"pattern":"pl4rd.com/hikaido*","zone_name":"pl4rd.com"}]` を追加してください。対象ゾーンの管理権限と既存ルートの競合を確認します。SvelteKitのbase pathは `/hikaido` です。Workers Logs/Tracesを有効化していますが、トークン・ユーザー入力・Webhook URLをアプリのログへ出力しません。

クイズページはnoindex、秘密付き結果とAPIはno-store。OGPは提供ブランド素材をもとに、クイズ名・問題数や結果の得点を反映した1200×630 PNGをWorkersで動的生成します。共通画像は `static/og-default.png` です。Web Share非対応ブラウザではURLコピーを使います。URLを知る全員が遊べる仕様で、完全なネタバレ防止・別端末での重複回答防止は行いません。

## 参照した公式資料

- https://svelte.dev/docs/kit/adapter-cloudflare
- https://svelte.dev/docs/kit/migrating-to-sveltekit-3
- https://biomejs.dev/introduction/language-support/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

ゲームの公式画像・ロゴは使用していません。診断・一致率は娯楽目的です。

## OGPと結果共有

トップのキャッチコピーは「あのヒカセンのこと、どのくらいしってる？」。操作・診断アイコンはLucideに統一しています。

- 共通画像: `/hikaido/og-default.png`
- クイズ画像: `/hikaido/og/quiz/<quizId>`（出題者名と問題数だけ）
- 結果共有ページ: `/hikaido/share/<shareId>`
- 結果画像: `/hikaido/og/result/<shareId>`（出題者名・得点・問題数だけ）

結果画面で「結果を共有」を押すと、結果閲覧の秘密を検証した後、独立した公開用IDを発行します。共有ページに回答者名・タイプ・各問題の回答・正解を含めません。回答やクイズの削除で共有IDもCASCADE削除し、非表示時も404になります。OG画像は存在確認後に内部キャッシュを参照し、クライアントにはno-storeを返します。SNS側で取得済みの画像キャッシュは本サービスから消去できません。

Satori 0.12.2のWASM版・Yoga・resvgのWASMを使用し、ViteではNodeでWASMモジュールを読み込み、ビルド後はWranglerが事前コンパイルしたWASMを使います。日本語キャラクター名の漢字欠けを防ぐため、Zen Maru Gothic Bold全文字フォントは静的アセットから読み込みます。OFLライセンスを同梱しています。画像生成のライブラリ・フォントはクライアントJSに含めません。

```sh
pnpm brand:generate -- --previews # 共通画像・favicon・埋め込みフォント・確認画像を再生成
pnpm db:migrate:local            # result_sharesを追加
pnpm build
pnpm dev:worker                  # http://127.0.0.1:8788/hikaido/ で実Worker確認
```

詳しい素材構成は `docs/brand.md` を参照してください。

着想元：[リカイド](https://rikaido.me/)（体験の構造を参考にしています）。
