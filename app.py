import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import json

def is_internal(url, base):
    return urlparse(url).netloc == urlparse(base).netloc

def crawl_site(start_url, max_links=100):
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
            response = requests.get(url, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            page_title = soup.title.string if soup.title else 'No title'
            internal_links = []

            for link in soup.find_all('a', href=True):
                href = urljoin(url, link.get('href'))
                if is_internal(href, start_url) and href not in visited:
                    internal_links.append(href)
                    if len(visited) < max_links:
                        crawl(href)

            site_structure[url] = {
                "title": page_title,
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
