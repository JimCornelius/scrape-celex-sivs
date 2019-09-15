# scrape-celex-sivs

Node app to scrape file IDs from https://eur-lex.europa.eu, and procces them to create mongodb of Standard Import Values.

1. Performs a search for files referencing the Standard Import Values for certain fruits and vegetables.
2. Iterates across results pages scraping for Celex File IDs and storing the result in a local mongodb db.
3. Process each CelexID into a full SIV listing from both HTML and where neccesary PDF files.
4. PDF scraping is performed with the assistance of pdfjs injected into the client side. 

Usage:  
node --experimental-modules **scrape-celex-sivs.js**   \[options\]

Command line optons:

  -c    : reset celex id documents <use with utmost extreme caution>
  -d    : reset SIV documents <use with extreme caution>  
  -f    : turn off auto-gathering of CelexIDs  
  -h    : turn headless mode off. Chromium broswer becomes visible  
  -l    : reset log  
  -p n  : start gathering at page n instead of the first page  
  -s n  : skip to position n in list of celed ids before processing  
  -x    : turn off processing of CelexIDs into SIVs

Requirements:  
Node.js, obviously, and mongodb running on local host default port. No security measures assumed.
Puppeteer is loaded from CDM and need not be installed locally.
