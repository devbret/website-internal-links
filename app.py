import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import json

def is_internal(url, base):
    return urlparse(url).netloc == urlparse(base).netloc

def crawl_site(start_url, max_links=100):
    visited = set()
    site_structure = {}
    total_links = []

    def crawl(url):
        if len(total_links) >= max_links:
            return
        if url in visited:
            return
        visited.add(url)
        print(f"Crawling: {url}")

        try:
            response = requests.get(url)
            soup = BeautifulSoup(response.text, 'html.parser')
            page_title = soup.title.string if soup.title else 'No title'
            internal_links = []

            for link in soup.find_all('a', href=True):
                href = link.get('href')
                full_url = urljoin(url, href)
                if is_internal(full_url, start_url) and full_url not in visited:
                    internal_links.append(full_url)
                    total_links.append(full_url)
                    if len(total_links) < max_links:
                        crawl(full_url)

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
