import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import json
import time

def is_internal(url, base):
    return urlparse(url).netloc == urlparse(base).netloc

def crawl_site(start_url, max_links=33):
    visited = set()
    site_structure = {}

    def crawl(url):
        if len(visited) >= max_links:
            return
        if url in visited:
            return
        visited.add(url)
        print(f"Crawling: {url}")

        try:
            start_time = time.time()
            response = requests.get(url, timeout=10)
            response_time = time.time() - start_time
            status_code = response.status_code

            soup = BeautifulSoup(response.text, 'html.parser')
            page_title = soup.title.string.strip() if soup.title else 'No title'

            meta_desc_tag = soup.find('meta', attrs={'name': 'description'})
            meta_description = meta_desc_tag['content'].strip() if meta_desc_tag and 'content' in meta_desc_tag.attrs else 'No meta description'

            meta_keywords_tag = soup.find('meta', attrs={'name': 'keywords'})
            meta_keywords = meta_keywords_tag['content'].strip() if meta_keywords_tag and 'content' in meta_keywords_tag.attrs else 'No meta keywords'

            h1_tags = [h1.get_text(strip=True) for h1 in soup.find_all('h1')]

            text = soup.get_text(separator=' ', strip=True)
            word_count = len(text.split())

            internal_links = []

            for link in soup.find_all('a', href=True):
                href = urljoin(url, link.get('href'))
                href = href.split('#')[0]
                href = href.rstrip('/')
                if is_internal(href, start_url) and href not in visited:
                    internal_links.append(href)
                    if len(visited) < max_links:
                        crawl(href)

            site_structure[url] = {
                "title": page_title,
                "meta_description": meta_description,
                "meta_keywords": meta_keywords,
                "h1_tags": h1_tags,
                "word_count": word_count,
                "status_code": status_code,
                "response_time": response_time,
                "links": internal_links
            }

        except requests.exceptions.RequestException as e:
            print(f"Failed to crawl {url}: {e}")

    crawl(start_url)
    return site_structure

def save_links_as_json(site_structure, filename='links.json'):
    with open(filename, 'w') as file:
        json.dump(site_structure, file, indent=2)

site_structure = crawl_site('https://www.example.com/')
save_links_as_json(site_structure)
