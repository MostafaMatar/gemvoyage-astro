#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API configuration
const API_BASE_URL = 'https://gemvoyage-backend.duckdns.org/api'; // Your backend API

async function fetchGems() {
  try {
    console.log(`Trying to fetch gems from: ${API_BASE_URL}/gem`);
    const response = await fetch(`${API_BASE_URL}/gem`);
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      // Try alternative endpoint
      console.log('Trying /gem/latest endpoint...');
      const latestResponse = await fetch(`${API_BASE_URL}/gem/latest`);
      if (latestResponse.ok) {
        const data = await latestResponse.json();
        const gems = Array.isArray(data) ? data : (data.content || []);
        console.log(`Fetched ${gems.length} gems from /gem/latest`);
        return gems;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle both paginated and direct array responses
    const gems = Array.isArray(data) ? data : (data.content || []);
    console.log(`Fetched ${gems.length} gems from API`);
    return gems;
  } catch (error) {
    console.error('Failed to fetch gems:', error);
    return [];
  }
}

async function fetchCities() {
  try {
    const response = await fetch(`${API_BASE_URL}/city`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const cities = await response.json();
    console.log(`Fetched ${cities.length} cities from API`);
    return cities;
  } catch (error) {
    console.error('Failed to fetch cities:', error);
    return [];
  }
}

function generateSitemap(gems, cities) {
  const baseUrl = 'https://gemvoyage.net';
  const currentDate = new Date().toISOString().split('T')[0];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Static pages
  const staticPages = [
    { path: '', priority: '1.0', changefreq: 'daily' },
    { path: '/browse', priority: '1.0', changefreq: 'daily' },
    { path: '/browse?category=Culture', priority: '0.9', changefreq: 'daily' },
    { path: '/browse?category=History', priority: '0.9', changefreq: 'daily' },
    { path: '/browse?category=Nature', priority: '0.9', changefreq: 'daily' },
    { path: '/browse?category=Shopping', priority: '0.9', changefreq: 'daily' },
    { path: '/browse?category=Food', priority: '0.9', changefreq: 'daily' },
    { path: '/browse?category=Entertainment', priority: '0.9', changefreq: 'daily' },
    { path: '/login', priority: '0.5', changefreq: 'monthly' },
    { path: '/register', priority: '0.5', changefreq: 'monthly' },
    { path: '/create', priority: '0.7', changefreq: 'weekly' },
    { path: '/terms', priority: '0.3', changefreq: 'yearly' },
    { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
    { path: '/sitemap', priority: '0.4', changefreq: 'monthly' },
  ];

  staticPages.forEach(page => {
    sitemap += `
  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  });

  // Gem pages
  gems.forEach(gem => {
    const gemId = gem.slug || gem.id;
    if (gemId) {
      sitemap += `
  <url>
    <loc>${baseUrl}/gem/${gemId}</loc>
    <lastmod>${gem.updatedAt ? gem.updatedAt.split('T')[0] : gem.createdAt.split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }
  });

  // City pages
  cities.forEach(city => {
    const citySlug = city.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    sitemap += `
  <url>
    <loc>${baseUrl}/city/${citySlug}</loc>
    <lastmod>${city.updatedAt ? city.updatedAt.split('T')[0] : currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  sitemap += `
</urlset>`;

  return sitemap;
}

async function main() {
  console.log('Generating sitemap...');
  
  const [gems, cities] = await Promise.all([
    fetchGems(),
    fetchCities()
  ]);
  
  const sitemap = generateSitemap(gems, cities);
  
  // Write sitemap to public directory
  const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');
  
  console.log(`Sitemap generated with ${gems.length} gem pages and ${cities.length} city pages`);
  console.log(`Sitemap saved to: ${sitemapPath}`);
}

// Enable fetch for Node.js
if (typeof fetch === 'undefined') {
  const { default: fetch } = await import('node-fetch');
  global.fetch = fetch;
}

main().catch(console.error);