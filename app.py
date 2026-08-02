import os
import sys
import threading
import requests
import subprocess
from urllib.parse import urlparse
import json
import time
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from collections import defaultdict, deque
import re
from dotenv import load_dotenv

from page_worker import analyze_page

from requests.adapters import HTTPAdapter
try:
    from urllib3.util.retry import Retry
except Exception:
    class Retry:
        def __init__(self, total=2, backoff_factor=0.3, status_forcelist=(429, 500, 502, 503, 504)):
            self.total = total
            self.backoff_factor = backoff_factor
            self.status_forcelist = status_forcelist

load_dotenv()

WEBSITE_TO_CRAWL = os.getenv("WEBSITE_TO_CRAWL", "https://www.example.com/")

MAX_PAGES_TO_CRAWL = int(os.getenv("MAX_PAGES_TO_CRAWL", "50"))

CRAWL_DELAY_SECONDS = float(os.getenv("CRAWL_DELAY_SECONDS", "1.0"))

FETCH_WORKERS = max(1, int(os.getenv("FETCH_WORKERS", "8")))

PARSE_WORKERS = max(1, int(os.getenv("PARSE_WORKERS", str(max(1, (os.cpu_count() or 2) - 1)))))

def extract_http_delivery(resp):
    h = {k.lower(): v for k, v in resp.headers.items()}
    set_cookie_header = resp.headers.get("set-cookie", "")
    cookies_simple = []
    if set_cookie_header:
        parts = [p.strip() for p in re.split(r',(?=[^ ;]+=)', set_cookie_header)]
        for c in parts:
            name = c.split(";", 1)[0].split("=", 1)[0].strip()
            if name:
                cookies_simple.append(name)

    chain = []
    for r in (resp.history or []):
        chain.append({
            "url": r.url,
            "status": r.status_code,
            "ttfb": round(getattr(r, "elapsed", None).total_seconds() if getattr(r, "elapsed", None) else 0, 3)
        })
    chain.append({
        "url": resp.url,
        "status": resp.status_code,
        "ttfb": round(resp.elapsed.total_seconds() if resp.elapsed else 0, 3)
    })

    return {
        "content_type": h.get("content-type", ""),
        "content_length": int(h.get("content-length") or 0),
        "content_encoding": h.get("content-encoding", ""),
        "cache_control": h.get("cache-control", ""),
        "etag": h.get("etag", ""),
        "last_modified": h.get("last-modified", ""),
        "server": h.get("server", ""),
        "x_powered_by": h.get("x-powered-by", ""),
        "set_cookies": cookies_simple,
        "redirect_chain": chain
    }

def extract_security_headers(resp):
    h = {k.lower(): v for k, v in resp.headers.items()}
    return {
        "content_security_policy": h.get("content-security-policy", ""),
        "strict_transport_security": h.get("strict-transport-security", ""),
        "x_frame_options": h.get("x-frame-options", ""),
        "x_content_type_options": h.get("x-content-type-options", ""),
        "referrer_policy": h.get("referrer-policy", ""),
        "permissions_policy": h.get("permissions-policy", "")
    }

def fetch_robots_and_sitemaps(base_url, session):
    root = urlparse(base_url)
    robots_url = f"{root.scheme}://{root.netloc}/robots.txt"
    sitemaps = []
    robots_txt = ""
    try:
        r = session.get(robots_url, timeout=8, headers={'User-Agent': 'MyCrawler/1.0'})
        if r.status_code == 200 and 'text' in r.headers.get('content-type',''):
            robots_txt = r.text[:10000]
            for line in robots_txt.splitlines():
                if line.lower().startswith('sitemap:'):
                    sm = line.split(':', 1)[1].strip()
                    sitemaps.append(sm)
    except Exception:
        pass
    guess = f"{root.scheme}://{root.netloc}/sitemap.xml"
    if guess not in sitemaps:
        try:
            g = session.get(guess, timeout=8, headers={'User-Agent': 'MyCrawler/1.0'})
            if g.status_code == 200 and 'xml' in g.headers.get('content-type',''):
                sitemaps.append(guess)
        except Exception:
            pass
    return {"robots_txt": robots_txt, "sitemaps": list(sorted(set(sitemaps)))}

def build_session():
    s = requests.Session()
    try:
        retry = Retry(
            total=3, backoff_factor=0.4,
            status_forcelist=(429, 500, 502, 503, 504),
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
        s.mount('http://', adapter)
        s.mount('https://', adapter)
    except Exception:
        pass
    s.headers.update({'User-Agent': 'MyCrawler/1.0'})
    return s

class RateLimiter:
    def __init__(self, min_interval):
        self.min_interval = min_interval
        self._lock = threading.Lock()
        self._next_time = 0.0

    def wait(self):
        if self.min_interval <= 0:
            return
        with self._lock:
            now = time.monotonic()
            delay = max(0.0, self._next_time - now)
            self._next_time = max(now, self._next_time) + self.min_interval
        if delay > 0:
            time.sleep(delay)

_thread_local = threading.local()

def get_thread_session():
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = build_session()
        _thread_local.session = session
    return session

def fetch_page(normalized_url, depth, rate_limiter):
    rate_limiter.wait()
    session = get_thread_session()

    try:
        start_time = time.time()
        response = session.get(normalized_url, timeout=10)
        response_time = time.time() - start_time
    except requests.exceptions.Timeout:
        print(f"Timeout crawling {normalized_url}")
        return {"page": {
            "url": normalized_url,
            "status_code": "Timeout",
            "error": "Request timed out",
            "depth": depth
        }}
    except requests.exceptions.RequestException as e:
        print(f"Failed to crawl {normalized_url}: {e}")
        return {"page": {
            "url": normalized_url,
            "status_code": "Error",
            "error": str(e),
            "depth": depth
        }}

    status_code = response.status_code
    ttfb = round(response.elapsed.total_seconds() if response.elapsed else 0, 3)

    if status_code != 200:
        print(f"Skipping {normalized_url} due to status code: {status_code}")
        return {"page": {
            "url": normalized_url,
            "status_code": status_code,
            "error": "Failed to fetch",
            "depth": depth,
            "ttfb": ttfb,
            "http_delivery": extract_http_delivery(response),
            "security": extract_security_headers(response),
        }}

    content_type = response.headers.get('content-type', '').lower()
    if 'text/html' not in content_type:
        print(f"Skipping {normalized_url} as content type is not HTML: {content_type}")
        return {"page": {
            "url": normalized_url,
            "status_code": status_code,
            "error": "Not HTML content",
            "depth": depth,
            "ttfb": ttfb,
            "http_delivery": extract_http_delivery(response),
            "security": extract_security_headers(response),
        }}

    return {
        "page": None,
        "html": response.text,
        "fetch_meta": {
            "status_code": status_code,
            "response_time": round(response_time, 2),
            "ttfb": ttfb,
            "http_delivery": extract_http_delivery(response),
            "security": extract_security_headers(response),
        }
    }

def crawl_site(start_url, max_links=MAX_PAGES_TO_CRAWL):
    session = build_session()

    start = start_url.rstrip('/')
    visited = set()
    site_structure = {}
    to_visit = deque([(start, 0)])
    queued = {start}
    in_edges = defaultdict(set)
    rate_limiter = RateLimiter(CRAWL_DELAY_SECONDS)

    site_meta = fetch_robots_and_sitemaps(start_url, session)

    pending = {}
    max_in_flight_fetches = FETCH_WORKERS * 2

    with ThreadPoolExecutor(max_workers=FETCH_WORKERS) as fetch_pool, \
         ProcessPoolExecutor(max_workers=PARSE_WORKERS) as parse_pool:

        def dispatch_fetches():
            in_flight = sum(1 for stage, _, _ in pending.values() if stage == "fetch")
            while to_visit and len(visited) < max_links and in_flight < max_in_flight_fetches:
                url, depth = to_visit.popleft()
                if url in visited:
                    continue
                visited.add(url)
                print(f"Crawling: {url} (depth {depth}) ({len(visited)}/{max_links})")
                future = fetch_pool.submit(fetch_page, url, depth, rate_limiter)
                pending[future] = ("fetch", url, depth)
                in_flight += 1

        dispatch_fetches()

        while pending:
            done, _ = concurrent.futures.wait(
                list(pending), return_when=concurrent.futures.FIRST_COMPLETED
            )
            for future in done:
                stage, url, depth = pending.pop(future)
                try:
                    result = future.result()
                except Exception as e:
                    print(f"An unexpected error occurred while processing {url}: {e}")
                    site_structure[url] = {
                        "url": url,
                        "status_code": "Processing Error",
                        "error": str(e),
                        "depth": depth
                    }
                    continue

                if stage == "fetch":
                    if result["page"] is not None:
                        site_structure[url] = result["page"]
                    else:
                        try:
                            parse_future = parse_pool.submit(
                                analyze_page, url, depth, result["html"], start_url, result["fetch_meta"]
                            )
                            pending[parse_future] = ("parse", url, depth)
                        except Exception as e:
                            print(f"An unexpected error occurred while processing {url}: {e}")
                            site_structure[url] = {
                                "url": url,
                                "status_code": "Processing Error",
                                "error": str(e),
                                "depth": depth
                            }
                else:
                    site_structure[url] = result
                    for target in set(result.get("internal_links") or []):
                        in_edges[target].add(url)
                        if target not in queued and len(queued) < max_links:
                            to_visit.append((target, depth + 1))
                            queued.add(target)

            dispatch_fetches()

    for url, data in site_structure.items():
        if not isinstance(data, dict):
            continue
        in_deg = len(in_edges.get(url, set()))
        out_deg = len(set(data.get("internal_links") or []))
        data["in_degree"] = in_deg
        data["out_degree"] = out_deg

    root_norm = start_url.rstrip('/')
    for url, data in site_structure.items():
        if not isinstance(data, dict):
            continue
        data["is_orphan"] = (url != root_norm and (data.get("in_degree") or 0) == 0)

    try:
        if root_norm in site_structure and isinstance(site_structure[root_norm], dict):
            site_structure[root_norm]["site_wide"] = site_meta
    except Exception:
        pass

    return site_structure

def save_links_as_json(site_structure, filename='links.json'):
    with open(filename, 'w', encoding='utf-8') as file:
        json.dump(site_structure, file, indent=2, ensure_ascii=False)
    print(f"Site structure saved to {filename}")

if __name__ == "__main__":
    crawled_site_structure = crawl_site(WEBSITE_TO_CRAWL, MAX_PAGES_TO_CRAWL)
    save_links_as_json(crawled_site_structure)
    print("Crawling complete. Starting Flask server subprocess...")
    subprocess.run([sys.executable, "flask_server.py"])
    print("Flask server subprocess has been initiated.")
