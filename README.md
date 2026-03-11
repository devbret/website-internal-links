# Mapping A Website's Internal Links

![Preview Of Resulting Visualization](https://hosting.photobucket.com/bbcfb0d4-be20-44a0-94dc-65bff8947cf2/9d320f08-dd19-4eb3-a89b-5bfd2873c2f0.png)

Explore a website's internal links, then visualize and interact with those connections as a network graph with scorecards and analysis using Claude AI.

## Set Up Instructions

Below are the required software programs and instructions for installing and using this application.

### Programs Needed

- [Git](https://git-scm.com/downloads)

- [Python](https://www.python.org/downloads/)

### Steps

1. Install the above programs

2. Open a terminal

3. Clone this repository using `git` by running the following command: `git clone git@github.com:devbret/website-internal-links.git`

4. Navigate to the repo's directory by running: `cd website-internal-links`

5. Create a virtual environment with this command: `python3 -m venv venv`

6. Activate your virtual environment using: `source venv/bin/activate`

7. Install the needed dependencies for running the script: `pip install -r requirements.txt`

8. Set the environment variable for your Anthropic API key by renaming the `.env.template` file to `.env` and placing your value immediately after the `=` character

9. Edit the `app.py` file `WEBSITE_TO_CRAWL` variable (on line 21), this is the website you would like to visualize
   - Also edit the `app.py` file `MAX_PAGES_TO_CRAWL` variable (on line 24) which specifies how many pages you would like to crawl

10. Run the script with the command: `python3 app.py`

11. To view the website's connections using the `index.html` file you will need to run the following command in a new terminal: `python3 -m http.server`

12. Once the network map has been launched, hover over any given node for more information about the particular web page, as well as the option submit data for analysis via Claude AI

13. By double-clicking on a node you will be sent to the related URL address in a new tab

14. To exit the virtual environment (venv), type this command in the terminal: `deactivate`

## Additional Notes

We use `textstat` for readability and `TextBlob` for sentiment. Beyond headings, alt text, labels and semantic tags, the crawler also records:

- **Status/Timing**: status code, TTFB, total response time

- **Structure**: word counts, H1s, paragraphs

- **Links**: internal/external, depth, orphan pages

- **SEO**: canonical, JSON-LD, OpenGraph, Twitter, hreflang

- **Security/Delivery**: CSP/HSTS headers, redirects, mixed content, cookies

- **Language**: `lang` vs detected

### Minor Features

Upon clicking any node, the shortest route back to the homepage is highlghted, giving a clear visual of how deeply the page sits within the site structure. This feature uses a breadth-first search to trace paths efficiently, even in large crawls. The result is an intuitive way to explore navigation depth and connectivity directly within the visualization.

### Performance Considerations

Generating visualizations with this app takes an unexpectedly large amount of processing power. It is advisable to experiment with mapping less than one hundred pages per launch.

## Troubleshooting

If working with GitHub codespaces, you may have to:

- `python -m nltk.downloader punkt_tab`

- Then reattempt steps 7 - 10

If all else fails, please contact the maintainer here on GitHub or via [LinkedIn](https://www.linkedin.com/in/bernhoftbret/).

Cheers!
