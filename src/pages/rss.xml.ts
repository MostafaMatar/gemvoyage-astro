import { API_BASE_URL } from '../lib/apiConfig';

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
  try {
    const response = await fetch(`${API_BASE_URL}/gem`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch gems: ${response.status}`);
    }
    
    const data = await response.json();
    const gems: Gem[] = data.gems || data || [];
    
    // Sort gems by creation date (newest first)
    const sortedGems = gems.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Generate RSS feed
    const rssContent = generateRSS(sortedGems);
    
    return new Response(rssContent, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    
    const errorFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>GemVoyage - Error</title>
    <link>https://gemvoyage.com</link>
    <description>Unable to load gems at the moment</description>
  </channel>
</rss>`;
    
    return new Response(errorFeed, {
      status: 500,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
      },
    });
  }
}

function generateRSS(gems: Gem[]): string {
  const baseURL = 'https://gemvoyage.com';
  
  const itemsXML = gems
    .map(gem => escapeXml(`
    <item>
      <title>${gem.title}</title>
      <link>${baseURL}/gem/${gem.slug}</link>
      <description>${gem.description}</description>
      <category>${gem.category}</category>
      <author>${gem.owner}</author>
      <pubDate>${new Date(gem.createdAt).toUTCString()}</pubDate>
      <guid isPermaLink="false">${gem.id}</guid>
      <location>${gem.location}</location>
      ${gem.image ? `<image>${gem.image}</image>` : ''}
      <upvotes>${gem.upvotes}</upvotes>
      <downvotes>${gem.downvotes}</downvotes>
    </item>`))
    .join('');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>GemVoyage - Hidden Gems &amp; Secret Destinations</title>
    <link>${baseURL}</link>
    <description>Discover extraordinary places shared by our community of travelers</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>3600</ttl>
    ${itemsXML}
  </channel>
</rss>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/[<]/g, '&lt;')
    .replace(/[>]/g, '&gt;')
    .replace(/["]/g, '&quot;')
    .replace(/[']/g, '&apos;')
    .replace(/[&]/g, '&amp;');
}
