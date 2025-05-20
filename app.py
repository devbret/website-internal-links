import requests
import subprocess
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
from dotenv import load_dotenv

load_dotenv()

nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)

# The website you would like to visualize.
WEBSITE_TO_CRAWL = 'https://example.com/' 

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
    images_without_alt = [img['src'] for img in images if not img.get('alt') or img.get('alt').strip() == '']
    return images_without_alt

def check_form_labels(soup):
    inputs = soup.find_all(['input', 'textarea', 'select'])
    labeled_inputs = set()
    for label in soup.find_all('label'):
        if label.get('for'):
            labeled_inputs.add(label['for'])
    inputs_without_labels = []
    for field in inputs:
        if field.get('id') and field.get('type') not in ['hidden', 'submit', 'button', 'reset']:
            if field['id'] not in labeled_inputs:
                parent_label = field.find_parent('label')
                if not parent_label:
                    inputs_without_labels.append(field['id'])
    return inputs_without_labels


def crawl_site(start_url, max_links=MAX_PAGES_TO_CRAWL):
    visited = set()
    site_structure = {}
    to_visit = [start_url.rstrip('/')]

    while to_visit and len(visited) < max_links:
        url = to_visit.pop(0)
        if url in visited:
            continue

        normalized_url = url.rstrip('/')
        if normalized_url in visited:
            continue
        
        visited.add(normalized_url)
        print(f"Crawling: {normalized_url} ({len(visited)}/{max_links})")

        try:
            start_time = time.time()
            response = requests.get(normalized_url, timeout=10, headers={'User-Agent': 'MyCrawler/1.0'})
            response_time = time.time() - start_time
            status_code = response.status_code

            if response.status_code != 200:
                print(f"Skipping {normalized_url} due to status code: {status_code}")
                site_structure[normalized_url] = {"status_code": status_code, "error": "Failed to fetch"}
                continue
            
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' not in content_type:
                print(f"Skipping {normalized_url} as content type is not HTML: {content_type}")
                site_structure[normalized_url] = {"status_code": status_code, "error": "Not HTML content"}
                continue

            soup = BeautifulSoup(response.text, 'html.parser')
            page_title = soup.title.string.strip() if soup.title else ''

            meta_desc_tag = soup.find('meta', attrs={'name': 'description'})
            meta_description = meta_desc_tag['content'].strip() if meta_desc_tag and 'content' in meta_desc_tag.attrs else ''

            meta_keywords_tag = soup.find('meta', attrs={'name': 'keywords'})
            meta_keywords = meta_keywords_tag['content'].strip() if meta_keywords_tag and 'content' in meta_keywords_tag.attrs else ''

            h1_tags = [h1.get_text(strip=True) for h1 in soup.find_all('h1')]

            text_content_for_analysis = []
            for element in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'span', 'article']):
                text_content_for_analysis.append(element.get_text(separator=' ', strip=True))
            text = " ".join(text_content_for_analysis)

            word_count = len(text.split()) if text else 0

            readability_score = textstat.flesch_kincaid_grade(text) if text else 0
            sentiment = TextBlob(text).sentiment.polarity if text else 0

            keyword_density = {}
            if text:
                text_clean = re.sub(r'[^\w\s]', '', text.lower())
                tokens = nltk.word_tokenize(text_clean)
                stop_words = set(stopwords.words('english'))
                filtered_tokens = [word for word in tokens if word not in stop_words and word.isalpha() and len(word) > 1]
                if filtered_tokens:
                    word_freq = Counter(filtered_tokens)
                    total_filtered_words = sum(word_freq.values())
                    most_common = word_freq.most_common(10)
                    keyword_density = {word: round(count / total_filtered_words, 4) for word, count in most_common}


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

            internal_links_found = []
            external_links_found = []

            for link_tag in soup.find_all('a', href=True):
                href = link_tag.get('href')
                if not href or href.startswith('#') or href.startswith('mailto:') or href.startswith('tel:'):
                    continue

                absolute_href = urljoin(normalized_url, href).split('#')[0].rstrip('/')

                if is_internal(absolute_href, start_url):
                    internal_links_found.append(absolute_href)
                    if absolute_href not in visited and absolute_href not in to_visit and len(visited) + len(to_visit) < max_links :
                        to_visit.append(absolute_href)
                else:
                    external_links_found.append(absolute_href)
            
            site_structure[normalized_url] = {
                "url": normalized_url,
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
                "response_time": round(response_time, 2),
                "internal_links": list(set(internal_links_found)),
                "external_links": list(set(external_links_found)),
                "semantic_elements": semantic_elements,
                "heading_issues": heading_issues,
                "unlabeled_inputs": unlabeled_inputs,
                "images_without_alt": images_without_alt
            }

        except requests.exceptions.Timeout:
            print(f"Timeout crawling {normalized_url}")
            site_structure[normalized_url] = {"status_code": "Timeout", "error": "Request timed out"}
        except requests.exceptions.RequestException as e:
            print(f"Failed to crawl {normalized_url}: {e}")
            site_structure[normalized_url] = {"status_code": "Error", "error": str(e)}
        except Exception as e:
            print(f"An unexpected error occurred while processing {normalized_url}: {e}")
            site_structure[normalized_url] = {"status_code": "Processing Error", "error": str(e)}


    return site_structure


def save_links_as_json(site_structure, filename='links.json'):
    with open(filename, 'w') as file:
        json.dump(site_structure, file, indent=2)
    print(f"Site structure saved to {filename}")

if __name__ == "__main__":
    crawled_site_structure = crawl_site(WEBSITE_TO_CRAWL, MAX_PAGES_TO_CRAWL)
    save_links_as_json(crawled_site_structure)
    print("Crawling complete. Starting Flask server subprocess...")
    subprocess.run(["python", "flask_server.py"])
    print("Flask server subprocess has been initiated.")