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

function extractGems(payload: unknown): Gem[] {
  if (Array.isArray(payload)) return payload as Gem[];
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.gems,
    record.items,
    record.results,
    record.data,
    (record.data as Record<string, unknown> | undefined)?.gems,
    (record.data as Record<string, unknown> | undefined)?.items,
    (record.data as Record<string, unknown> | undefined)?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Gem[];
  }

  return [];
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toAbsoluteUrl(url?: string) {
  if (!url) return '';
  try {
    return new URL(url, SITE_URL).toString();
  } catch {
    return '';
  }
}

export async function GET() {
  let gems: Gem[] = [];

  try {
    const response = await fetch(`${API_BASE_URL}/gem/latest`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch gems: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    gems = extractGems(data).filter(
      (gem): gem is Gem => Boolean(gem?.slug && gem?.title && gem?.createdAt)
    );
  } catch (err) {
    console.error('Error fetching latest gems for RSS:', err);
    gems = [];
  }

  const items = gems
    .map((gem) => {
      const imageUrl = toAbsoluteUrl(gem.image);
      const pubDate = new Date(gem.createdAt);
      const link = `${SITE_URL}/gems/${gem.slug}`;

      return `
    <item>
      <title>${escapeXml(gem.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <description>${escapeXml(gem.description || '')}</description>
      <category>${escapeXml(gem.category || '')}</category>
      <pubDate>${Number.isNaN(pubDate.getTime()) ? new Date().toUTCString() : pubDate.toUTCString()}</pubDate>
      ${imageUrl ? `<enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />` : ''}
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
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
