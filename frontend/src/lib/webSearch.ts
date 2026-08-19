export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export async function webSearch(
  query: string,
  numResults: number = 5,
  apiKey?: string
): Promise<SearchResult[]> {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim();
  const results: SearchResult[] = [];

  const tavilyKey =
    apiKey ||
    process.env.TAVILY_API_KEY ||
    process.env.NEXT_PUBLIC_TAVILY_API_KEY ||
    '';

  // 1. Tavily API Search (if valid key provided)
  if (tavilyKey && tavilyKey !== 'tvly-demo-key') {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: cleanQuery,
          max_results: numResults,
          search_depth: 'basic',
          include_answer: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.results) && data.results.length > 0) {
          return data.results.slice(0, numResults).map((r: any) => ({
            title: r.title || 'Web Result',
            snippet: r.content || r.snippet || '',
            url: r.url || '',
          }));
        }
      }
    } catch (err) {
      console.warn('Tavily API search error:', err);
    }
  }

  // 2. DuckDuckGo Instant Answer / Topics Search
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&no_redirect=1`;
    const resp = await fetch(ddgUrl, { signal: AbortSignal.timeout(4000) });
    if (resp.ok) {
      const data = await resp.json();

      if (data.AbstractText) {
        results.push({
          title: data.Heading || cleanQuery,
          snippet: data.AbstractText,
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.slice(0, 60) + '...',
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
          if (results.length >= numResults) break;
        }
      }

      if (results.length >= numResults) return results;
    }
  } catch (err) {
    console.warn('DuckDuckGo search error:', err);
  }

  // 3. Wikipedia API Search fallback (fast, rich knowledge for topics/terms/events)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQuery)}&limit=${numResults}&namespace=0&format=json&origin=*`;
    const wikiResp = await fetch(wikiUrl, { signal: AbortSignal.timeout(4000) });
    if (wikiResp.ok) {
      const wikiData = await wikiResp.json();
      // format: [query, [titles], [descriptions], [urls]]
      if (Array.isArray(wikiData) && wikiData.length >= 4) {
        const titles = wikiData[1] || [];
        const descs = wikiData[2] || [];
        const urls = wikiData[3] || [];
        for (let i = 0; i < titles.length; i++) {
          if (titles[i] && (descs[i] || urls[i])) {
            results.push({
              title: titles[i],
              snippet: descs[i] || `Information regarding ${titles[i]}`,
              url: urls[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(titles[i])}`,
            });
          }
          if (results.length >= numResults) break;
        }
      }
    }
  } catch (err) {
    console.warn('Wikipedia search error:', err);
  }

  return results.slice(0, numResults);
}
