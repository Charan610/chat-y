import asyncio
import logging
import urllib.parse
from typing import List, Dict
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self):
        self._headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    async def search(self, query: str, num_results: int = 5) -> List[Dict[str, str]]:
        """
        Search using Yahoo Search interface.
        Returns list of {title, url, snippet} dicts.
        """
        try:
            encoded_query = urllib.parse.quote_plus(query)
            url = f"https://search.yahoo.com/search?p={encoded_query}"

            async with httpx.AsyncClient(
                headers=self._headers,
                timeout=10.0,
                follow_redirects=True,
            ) as client:
                response = await client.get(url)
                response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            results = []

            # Yahoo HTML search results are grouped inside elements with class "algo-sr"
            result_items = soup.find_all("div", class_="algo-sr")

            for item in result_items[:num_results]:
                try:
                    title_tag = item.find("h3", class_="title")
                    link_tag = item.find("a")
                    snippet_tag = item.find("div", class_="compText")

                    if not link_tag:
                        continue

                    title = title_tag.get_text(strip=True) if title_tag else link_tag.get_text(strip=True)
                    href = link_tag.get("href", "")

                    # Yahoo wraps URLs in a redirect URL: /RU=https://real-url.com/RK=...
                    if "/RU=" in href:
                        try:
                            # Extract between /RU= and /RK=
                            ru_part = href.split("/RU=")[1].split("/RK=")[0]
                            href = urllib.parse.unquote(ru_part)
                        except Exception:
                            pass

                    # Clean snippet content
                    snippet = ""
                    if snippet_tag:
                        # Remove date spans if present
                        date_span = snippet_tag.find("span", class_="fc-smoke")
                        if date_span:
                            date_span.decompose()
                        snippet = snippet_tag.get_text(strip=True)

                    if title and href:
                        results.append({
                            "title": title,
                            "url": href,
                            "snippet": snippet,
                        })
                except Exception as e:
                    logger.debug(f"Failed parsing single result item: {e}")
                    continue

            # Fallback to general link parsing if class-based scraping fails
            if not results:
                links = soup.find_all("a")
                for link in links:
                    href = link.get("href", "")
                    title = link.get_text(strip=True)
                    if "/RU=" in href and len(title) > 10:
                        try:
                            ru_part = href.split("/RU=")[1].split("/RK=")[0]
                            real_url = urllib.parse.unquote(ru_part)
                            results.append({
                                "title": title,
                                "url": real_url,
                                "snippet": "Search result link found on search engine page."
                            })
                            if len(results) >= num_results:
                                break
                        except Exception:
                            continue

            return results[:num_results]

        except Exception as e:
            logger.error(f"Web search scraping error: {e}")
            return []
