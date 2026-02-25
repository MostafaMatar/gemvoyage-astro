import { getCollection } from 'astro:content';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc1123(date) {
  return new Date(date).toUTCString();
}

export async function GET({ site, request }) {
  const base = site ? String(site).replace(/\/$/, '') : new URL(request.url).origin;
  const posts = await getCollection('blog');

  const sorted = posts.sort((a, b) => {
    const da = new Date(a.data.pubDate).valueOf();
    const db = new Date(b.data.pubDate).valueOf();
    return db - da;
  });

  const items = sorted.map(post => {
    const loc = `${base}/blog/${post.slug}/`;
    const title = escapeXml(post.data.title || '');
    const description = escapeXml(post.data.description || '');
    const pubDate = post.data.pubDate ? toRfc1123(post.data.pubDate) : '';
    return `<item>
  <title>${title}</title>
  <link>${loc}</link>
  <guid isPermaLink="true">${loc}</guid>
  <description>${description}</description>
  ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
</item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>GemVoyage Blog</title>
  <link>${base}/</link>
  <description>Travel guides, itineraries, rank lists, and more.</description>
  ${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
}
