# ブランド素材とOGP

提供された `hikaido-img/hikaido` のブランド素材を使用する。素材はリポジトリに取り込んであり、元ディレクトリへの実行時依存はない。

- `src/lib/assets/brand/symbol.svg`: 提供されたハート形シンボルのマスター。faviconとOGP用。
- `src/lib/components/Brand.svelte`: ヘッダー。Lucide Heartと「ひかいど」のみ。
- `src/lib/components/Icon.svelte`: Lucideの操作・診断アイコン。
- `src/lib/server/og/templates.ts`: 共通・クイズ・結果画像の型付きテンプレート。
- `src/lib/server/og/render.ts`: WorkersでのPNG描画、内部キャッシュ。公開状態の確認はエンドポイント側で先に行う。
- `src/lib/server/og/assets.generated.js`: マスターシンボル・サブセットフォントの自動生成データ。
- `scripts/brand/generate.ts`: 素材再生成。`pnpm brand:generate -- --previews`。
- `scripts/brand/fonts-src/`: 再生成用のZen Maru Gothic Bold/BlackとOFL。
- `static/fonts/`: 漢字を含む任意の日本語名を描画するための全文字BoldとOFL。
- `static/og-default.png`: 共通OGP。1200×630。
- `static/favicon*`, `static/apple-touch-icon.png`, `static/icon-*.png`: サイトアイコン。
- `previews/`: 再生成された確認用画像。

キャッチコピーは「あのヒカセンのこと、どのくらいしってる？」。ピンク・ラベンダー・ローズは提供されたCatppuccin系配色を保持する。アプリの既存Latte/Macchiatoテーマを維持し、ヘッダーに提供シンボルや英字名は表示しない。

クイズOGPから正解・タイプを明かさない。結果共有は本人が操作したときに別の公開IDを発行し、得点だけを表示する。タイプカードの公開共有は実装しない。

Satoriは事前コンパイル済みYogaを明示的に注入できる0.12.2に固定している。更新時はViteだけでなく `pnpm dev:worker` でPNG生成を検証する。名前には全文字フォントの独立したファミリーを指定し、固定文言用サブセットの漢字欠けを避ける。ロゴ行は高さを確保し、大きな結果ハートによって縮められないようにする。
