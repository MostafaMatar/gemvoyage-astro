import { API_BASE_URL } from '../lib/apiConfig';

export const prerender = false; // ensure this runs server-side

const SITE_URL = 'https://gemvoyage.net';

interface Gem {
  id: string;
  title: string;
  description: string;
  image?: string;
  location: string;
  category: string;
  createdAt: string;
  slug: string;
  featured?: boolean;
  owner: string;
  upvotes: number;
  downvotes: number;
}

export async function GET() {
  let gems: Gem[] = [];

  try {
    const response = await fetch(`${API_BASE_URL}/gem/latest`);
    console.log('[RSS] API response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch gems: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[RSS] Raw data sample:', JSON.stringify(data).slice(0, 1000));

    // Extract an items array from various possible response shapes.
    const extractArray = (obj: any): any[] => {
      if (Array.isArray(obj)) return obj;
      if (!obj || typeof obj !== 'object') return [];
      const keys = ['gems', 'data', 'items', 'results', 'rows'];
      for (const k of keys) {
        if (Array.isArray(obj[k])) return obj[k];
      }
      // shallow search for first array value (covers nested shapes like { data: { items: [...] } })
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) return v;
        if (v && typeof v === 'object') {
          for (const vv of Object.values(v)) {
            if (Array.isArray(vv)) return vv;
          }
        }
      }
      return [];
    };

    gems = extractArray(data);
    console.log('[RSS] Gems count:', gems.length);
  } catch (err) {
    console.error('Error fetching latest gems for RSS:', err);
    gems = [];
  }

  const items = gems
    .map((gem) => {
      // safe fallbacks for common field names
      const title = gem.title || gem.name || 'Untitled';
      const slug = gem.slug || gem.id || String(gem._id || '');
      const description = gem.description || gem.excerpt || '';
      const category = gem.category || gem.tags?.[0] || '';
      const created = gem.createdAt || gem.created_at || gem.created || new Date().toISOString();
      const image = gem.image || gem.thumbnail || '';

      return `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${SITE_URL}/gems/${slug}</link>
      <guid>${SITE_URL}/gems/${slug}</guid>
      <description><![CDATA[${description}]]></description>
      <category><![CDATA[${category}]]></category>
      <pubDate>${new Date(created).toUTCString()}</pubDate>
      ${image ? `<enclosure url="${image}" type="image/jpeg" />` : ''}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GemVoyage - Latest Discoveries</title>
    <link>${SITE_URL}</link>
    <description>Discover hidden treasures around the world, shared by real travelers.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
