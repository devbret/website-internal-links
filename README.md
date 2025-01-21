# Mapping A Website's Internal Links

![Preview Of Resulting Visualization](https://hosting.photobucket.com/images/i/bernhoftbret/website-internal-links-mapped.png)

Use Python to map a website's internal links. And then apply D3 to visualize those connections as an interactive network graph.

## Set Up

### Programs Needed

- [Git](https://git-scm.com/downloads)
- [Python](https://www.python.org/downloads/) (When installing on Windows, make sure you check the "[Add python 3.xx to PATH](https://hosting.photobucket.com/images/i/bernhoftbret/python.png)" box.)

### Steps

1. Install the above programs.
2. Open a shell window (For Windows open PowerShell, for MacOS open Terminal & for Linux open your distro's terminal emulator).
3. Clone this repository using `git` by running the following command; `git clone git@github.com:devbret/website-internal-links.git`.
4. Navigate to the repo's directory by running; `cd website-internal-links`.
5. Install the needed dependencies for running the script by running; `pip install -r requirements.txt`.
6. Edit the app.py file on line 115, to include the website that you would like to visualize.
7. Run the script with the command `python3 app.py`.
8. To view the website's connections in the index.html file you will need to run a local web server. To do this run `python3 -m http.server`.
9. Once the network map has been launched, hover over any given node for more information about the particular web page. By clicking on a node, you will be sent to the related URL address.
