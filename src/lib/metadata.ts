import { base, origin } from "./paths";
export const catchphrase = "あのヒカセンのこと、どのくらいしってる？";
export function buildMetadata({
  title = "ひかいど | ヒカセンの2択理解度チェック",
  description = catchphrase,
  path = "/",
  image = "/og-default.png",
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
} = {}) {
  return {
    title,
    description,
    url: `${origin}${base}${path}`,
    image: `${origin}${base}${image}`,
  };
}
