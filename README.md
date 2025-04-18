# Mapping A Website's Internal Links

![Preview Of Resulting Visualization](https://hosting.photobucket.com/bbcfb0d4-be20-44a0-94dc-65bff8947cf2/ad55b31e-edf3-4a21-a6a2-3e61f4d84a0b.jpg)

Use Python to explore a website's internal links. Then apply D3 to visualize those connections as an interactive network graph with scorecards.

## Set Up

### Programs Needed

- [Git](https://git-scm.com/downloads)
- [Python](https://www.python.org/downloads/) (When installing on Windows, make sure you check the "[Add python 3.xx to PATH](https://hosting.photobucket.com/images/i/bernhoftbret/python.png)" box.)

### Steps

1. Install the above programs.
2. Open a shell window (For Windows open PowerShell, for MacOS open Terminal & for Linux open your distro's terminal emulator).
3. Clone this repository using `git` by running the following command: `git clone git@github.com:devbret/website-internal-links.git`.
4. Navigate to the repo's directory by running: `cd website-internal-links`.
5. Create a virtual environment with this command: `python3 -m venv venv`. Then activate your virutal environment using: `source venv/bin/activate`.
6. Install the needed dependencies for running the script by running: `pip install -r requirements.txt`.
7. Edit the app.py file on line 154, to include the website you would like to visualize. Also edit the app.py file on line 51 to specify how many pages you would like to crawl.
8. Run the script with the command `python3 app.py`.
9. To view the website's connections using the index.html file you will need to run a local web server. To do this run: `python3 -m http.server`.
10. Once the network map has been launched, hover over any given node for more information about the particular web page. By clicking on a node, you will be sent to the related URL address.

## Please Also Consider

Generating visualizations for this app takes an unexpectedly large amount of processing power. It is thus advisable to initially experiment with mapping less than one hundred pages per launch.
