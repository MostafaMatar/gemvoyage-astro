import { API_BASE_URL } from '../lib/apiConfig';

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
  owner: string;
}

export async function GET() {
  let gems: Gem[] = [];

  try {
    const response = await fetch(`${API_BASE_URL}/gem/latest`);

    if (!response.ok) {
      throw new Error(`Failed to fetch gems: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    gems = data.gems || data || [];
  } catch (err) {
    console.error('Error fetching latest gems for RSS:', err);
    gems = [];
  }

  const items = gems
    .map(
      (gem) => `
    <item>
      <title><![CDATA[${gem.title}]]></title>
      <link>${SITE_URL}/gems/${gem.slug}</link>
      <guid>${SITE_URL}/gems/${gem.slug}</guid>
      <description><![CDATA[${gem.description}]]></description>
      <category><![CDATA[${gem.category}]]></category>
      <pubDate>${new Date(gem.createdAt).toUTCString()}</pubDate>
      ${gem.image ? `<enclosure url="${gem.image}" type="image/jpeg" />` : ''}
    </item>`
    )
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
