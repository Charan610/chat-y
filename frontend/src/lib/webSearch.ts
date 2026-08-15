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
  const tavilyKey =
    apiKey ||
    process.env.TAVILY_API_KEY ||
    process.env.NEXT_PUBLIC_TAVILY_API_KEY ||
    '';

  if (!query || !query.trim()) return [];

  // 1. Tavily API Search
  if (tavilyKey) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: query.trim(),
          max_results: numResults,
          search_depth: 'basic',
          include_answer: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.results)) {
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

  // 2. Client-side DuckDuckGo fallback API
  try {
    const fallbackUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1&no_redirect=1`;
    const resp = await fetch(fallbackUrl);
    if (resp.ok) {
      const data = await resp.json();
      const results: SearchResult[] = [];

      if (data.AbstractText) {
        results.push({
          title: data.Heading || 'DuckDuckGo Instant Answer',
          snippet: data.AbstractText,
          url: data.AbstractURL || 'https://duckduckgo.com',
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

      if (results.length > 0) return results;
    }
  } catch (err) {
    console.warn('DuckDuckGo fallback search error:', err);
  }

  return [];
}
