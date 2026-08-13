import asyncio
import logging
import urllib.parse
import os
from typing import List, Dict
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self):
        self._headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    async def search(self, query: str, num_results: int = 5, tavily_api_key: str = None) -> List[Dict[str, str]]:
        """
        Structured web search using Tavily API (if available) or DuckDuckGo Search.
        Returns list of {title, url, snippet} dicts.
        """
        api_key = tavily_api_key or os.getenv("TAVILY_API_KEY")
        if api_key:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.tavily.com/search",
                        json={"api_key": api_key, "query": query, "max_results": num_results, "search_depth": "basic"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        results = []
                        for res in data.get("results", []):
                            results.append({
                                "title": res.get("title", ""),
                                "url": res.get("url", ""),
                                "snippet": res.get("content", ""),
                            })
                        if results:
                            return results[:num_results]
            except Exception as e:
                logger.warning(f"Tavily API search error, falling back to DuckDuckGo: {e}")

        # DuckDuckGo fallback
        try:
            url = "https://html.duckduckgo.com/html/"
            async with httpx.AsyncClient(headers=self._headers, timeout=10.0, follow_redirects=True) as client:
                resp = await client.post(url, data={"q": query, "b": ""})
                resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            results = []
            result_nodes = soup.find_all("div", class_="result")

            for node in result_nodes[:num_results]:
                try:
                    a_tag = node.find("a", class_="result__a")
                    snippet_tag = node.find("a", class_="result__snippet")
                    if not a_tag:
                        continue
                    title = a_tag.get_text(strip=True)
                    href = a_tag.get("href", "")
                    if href.startswith("//duckduckgo.com/l/?uddg="):
                        parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                        if "uddg" in parsed:
                            href = parsed["uddg"][0]
                    snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
                    if title and href:
                        results.append({"title": title, "url": href, "snippet": snippet})
                except Exception:
                    continue

            return results[:num_results]
        except Exception as e:
            logger.error(f"DuckDuckGo web search error: {e}")
            return []
