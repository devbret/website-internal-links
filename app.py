import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import json

def is_internal(url, base):
    return urlparse(url).netloc == urlparse(base).netloc

def crawl_site(start_url, max_links=100):
    visited = set()
    links = {}
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

            for link in soup.find_all('a', href=True):
                href = link.get('href')
                full_url = urljoin(url, href)
                if is_internal(full_url, start_url) and full_url not in visited:
                    if url not in links:
                        links[url] = []
                    links[url].append(full_url)
                    total_links.append(full_url)
                    if len(total_links) < max_links:
                        crawl(full_url)
        except requests.exceptions.RequestException as e:
            print(f"Failed to crawl {url}: {e}")

    crawl(start_url)
    return links

def save_links_as_json(links, filename='links.json'):
    with open(filename, 'w') as file:
        json.dump(links, file, indent=2)

site_links = crawl_site('https://www.example.com/')
save_links_as_json(site_links)

