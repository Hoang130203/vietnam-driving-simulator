import {readdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

const origin = "https://vivu3d.com";

// The source pages also run under a plain file server. Use clean URLs in the
// hosted copy, including links created by the game's JavaScript.
export async function preparePageUrls(client) {
  const entries = await readdir(client, {withFileTypes: true});
  const files = entries.filter(entry => entry.isFile()).map(entry => entry.name);
  const pages = files.filter(name => name.endsWith(".html")).sort();
  const paths = pages.map(name => name === "index.html" ? "/" : "/" + name.slice(0, -5));
  const byFilename = new Map(pages.map((name, i) => [name, paths[i]]));
  const localPage = /(["'])(?:\.\/)?([a-z0-9-]+\.html)(?=["'?#])/g;

  for (const filename of files.filter(name => /\.(html|js)$/.test(name))) {
    const file = path.join(client, filename);
    const source = await readFile(file, "utf8");
    if (byFilename.has(filename)) {
      const canonical = origin + byFilename.get(filename);
      if (!source.includes('<link rel="canonical" href="' + canonical + '">')) {
        throw new Error("Missing canonical for " + filename);
      }
    }
    const hosted = source.replace(localPage, (match, quote, name) =>
      byFilename.has(name) ? quote + byFilename.get(name) : match);
    if (hosted !== source) await writeFile(file, hosted);
  }

  // Sites can serve assets before invoking the Worker. Give the asset router
  // the same permanent redirects for bookmarked HTML and trailing-slash URLs.
  const redirects = pages.map(name => "/" + name + " " + byFilename.get(name) + " 301");
  for (const url of paths) {
    if (url !== "/") redirects.push(url + "/ " + url + " 301");
  }
  await writeFile(path.join(client, "_redirects"), redirects.join("\n") + "\n");

  const urls = ["/", ...paths.filter(url => url !== "/")];
  const entriesXml = urls.map(url => "  <url><loc>" + origin + url + "</loc></url>");
  await writeFile(path.join(client, "sitemap.xml"), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entriesXml, "</urlset>", "",
  ].join("\n"));
  return paths;
}
