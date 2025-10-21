# Mapping A Website's Internal Links

![Preview Of Resulting Visualization](https://hosting.photobucket.com/bbcfb0d4-be20-44a0-94dc-65bff8947cf2/b0ff2b96-c2f3-42e2-a772-40a6943c1400.jpg)

Explore a website's internal links, then visualize those connections as a network graph with scorecards and analysis using Claude AI.

## Set Up

### Programs Needed

- [Git](https://git-scm.com/downloads)
- [Python](https://www.python.org/downloads/) (When installing on Windows, make sure you check the "[Add python 3.xx to PATH](https://hosting.photobucket.com/images/i/bernhoftbret/python.png)" box.)

### Steps

1. Install the above programs.

2. Open a shell window (For Windows open PowerShell, for MacOS open Terminal & for Linux open your distro's terminal emulator).

3. Clone this repository using `git` by running the following command: `git clone git@github.com:devbret/website-internal-links.git`.

4. Navigate to the repo's directory by running: `cd website-internal-links`.

5. Create a virtual environment with this command: `python3 -m venv venv`. Then activate your virtual environment using: `source venv/bin/activate`.

6. Install the needed dependencies for running the script by running: `pip install -r requirements.txt`.

7. Set the environment variable for the Anthropic API key by renaming the `.env.template` file to `.env` and placing your value immediately after the `=` character.

8. Edit the app.py file `WEBSITE_TO_CRAWL` variable (on line 21), this is the website you would like to visualize.

   - Also edit the app.py file `MAX_PAGES_TO_CRAWL` variable (on line 24), this specifies how many pages you would like to crawl.

9. Run the script with the command `python3 app.py`.

10. To view the website's connections using the index.html file you will need to run a local web server. To do this run `python3 -m http.server` in a new terminal.

11. Once the network map has been launched, hover over any given node for more information about the particular web page, as well as the option submit data for analysis via Claude AI. By clicking on a node, you will be sent to the related URL address in a new tab.

12. To exit the virtual environment (venv), type: `deactivate` in the terminal.

## Performance Considerations

Generating visualizations for this app takes an unexpectedly large amount of processing power. It is thus advisable to initially experiment with mapping less than one hundred pages per launch.

## Additional Notes

We use textstat for readability and TextBlob for sentiment. Beyond headings, alt text, labels and semantic tags, the crawler also records:

- Status/Timing: status code, TTFB, total response time

- Structure: word counts, H1s, paragraphs

- Links: internal/external, depth, orphan pages

- SEO: canonical, JSON-LD, OpenGraph, Twitter, hreflang

- Security/Delivery: CSP/HSTS headers, redirects, mixed content, cookies

- Language: `lang` vs detected

## Troubleshooting

If working with GitHub codespaces, you may have to:

- `python -m nltk.downloader punkt_tab`

- Then reattempt steps 6 - 9.

If all else fails, please contact the maintainer here on GitHub or via [LinkedIn](https://www.linkedin.com/in/bernhoftbret/).

Cheers!
