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
nltk.download('stopwords')

# The website you would like to visualize.
WEBSITE_TO_CRAWL = 'https://example.com'

# Specify how many pages you would like to crawl.
MAX_PAGES_TO_CRAWL = 20

def is_internal(url, base):
    return urlparse(url).netloc == urlparse(base).netloc

def check_heading_structure(soup):
    headings = [int(tag.name[1]) for tag in soup.find_all(re.compile('^h[1-6]$'))]
    skipped_levels = []
    prev_level = 0
    for level in headings:
        if prev_level and level > prev_level + 1:
            skipped_levels.append((prev_level, level))
        prev_level = level
    return skipped_levels

def check_semantic_elements(soup):
    semantic_tags = ['main', 'nav', 'article', 'section', 'header', 'footer', 'aside']
    used_semantics = {tag: bool(soup.find(tag)) for tag in semantic_tags}
    return used_semantics

def check_image_alts(soup):
    images = soup.find_all('img')
    images_without_alt = [img['src'] for img in images if not img.get('alt')]
    return images_without_alt

def check_form_labels(soup):
    inputs = soup.find_all(['input', 'textarea', 'select'])
    labeled_inputs = set()
    for label in soup.find_all('label'):
        if label.get('for'):
            labeled_inputs.add(label['for'])
    inputs_without_labels = []
    for field in inputs:
        if field.get('id') and field['id'] not in labeled_inputs:
            inputs_without_labels.append(field['id'])
    return inputs_without_labels

def crawl_site(start_url, max_links=MAX_PAGES_TO_CRAWL):
    visited = set()
    site_structure = {}

    def crawl(url):
        if len(visited) >= max_links or url in visited:
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
            keyword_density = {word: count / total_filtered_words for word, count in most_common}

            image_count = len(soup.find_all('img'))
            script_count = len(soup.find_all('script'))
            stylesheet_count = len(soup.find_all('link', rel='stylesheet'))
            has_viewport_meta = bool(soup.find('meta', attrs={'name': 'viewport'}))
            heading_count = len(soup.find_all(['h2', 'h3', 'h4', 'h5', 'h6']))
            paragraph_count = len(soup.find_all('p'))

            semantic_elements = check_semantic_elements(soup)
            heading_issues = check_heading_structure(soup)
            unlabeled_inputs = check_form_labels(soup)
            images_without_alt = check_image_alts(soup)

            internal_links = []
            external_links = []

            for link in soup.find_all('a', href=True):
                href = urljoin(url, link.get('href')).split('#')[0].rstrip('/')
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
                "script_count": script_count,
                "stylesheet_count": stylesheet_count,
                "has_viewport_meta": has_viewport_meta,
                "heading_count": heading_count,
                "paragraph_count": paragraph_count,
                "status_code": status_code,
                "response_time": response_time,
                "internal_links": internal_links,
                "external_links": external_links,
                "semantic_elements": semantic_elements,
                "heading_issues": heading_issues,
                "unlabeled_inputs": unlabeled_inputs,
                "images_without_alt": images_without_alt
            }

        except requests.exceptions.RequestException as e:
            print(f"Failed to crawl {url}: {e}")

    crawl(start_url)
    return site_structure

def save_links_as_json(site_structure, filename='links.json'):
    with open(filename, 'w') as file:
        json.dump(site_structure, file, indent=2)

site_structure = crawl_site(WEBSITE_TO_CRAWL)
save_links_as_json(site_structure)
