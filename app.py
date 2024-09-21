import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import json
import time
import textstat
from textblob import TextBlob
import nltk
from nltk.corpus import stopwords
from collections import Counter
import re

nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')

def is_internal(url, base):
    return urlparse(url).netloc == urlparse(base).netloc

def crawl_site(start_url, max_links=25):
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
            page_title = soup.title.string.strip() if soup.title else ''

            meta_desc_tag = soup.find('meta', attrs={'name': 'description'})
            meta_description = meta_desc_tag['content'].strip() if meta_desc_tag and 'content' in meta_desc_tag.attrs else ''

            meta_keywords_tag = soup.find('meta', attrs={'name': 'keywords'})
            meta_keywords = meta_keywords_tag['content'].strip() if meta_keywords_tag and 'content' in meta_keywords_tag.attrs else ''

            h1_tags = [h1.get_text(strip=True) for h1 in soup.find_all('h1')]

            text = soup.get_text(separator=' ', strip=True)
            word_count = len(text.split())

            readability_score = textstat.flesch_kincaid_grade(text)

            sentiment = TextBlob(text).sentiment.polarity

            text_clean = re.sub(r'[^\w\s]', '', text.lower())

            tokens = nltk.word_tokenize(text_clean)

            stop_words = set(stopwords.words('english'))
            filtered_tokens = [word for word in tokens if word not in stop_words and word.isalpha()]

            word_freq = Counter(filtered_tokens)

            total_filtered_words = sum(word_freq.values())

            most_common = word_freq.most_common(10)

            keyword_density = {}
            for word, count in most_common:
                density = count / total_filtered_words if total_filtered_words else 0
                keyword_density[word] = density

            image_count = len(soup.find_all('img'))

            internal_links = []
            external_links = []
            for link in soup.find_all('a', href=True):
                href = urljoin(url, link.get('href'))
                href = href.split('#')[0]
                href = href.rstrip('/')
                if is_internal(href, start_url):
                    internal_links.append(href)
                    if len(visited) < max_links:
                        crawl(href)
                else:
                    external_links.append(href)

            site_structure[url] = {
                "title": page_title,
                "meta_description": meta_description,
                "meta_keywords": meta_keywords,
                "h1_tags": h1_tags,
                "word_count": word_count,
                "readability_score": readability_score,
                "sentiment": sentiment,
                "keyword_density": keyword_density,
                "image_count": image_count,
                "status_code": status_code,
                "response_time": response_time,
                "internal_links": internal_links,
                "external_links": external_links
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
