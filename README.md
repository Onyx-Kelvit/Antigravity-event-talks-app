# BigQuery Release Notes Hub 🚀

A sleek, responsive, and modern web application to monitor official Google Cloud BigQuery Release Notes. The application parses the Atom feed, classifies updates, supports keyword searches, and features a built-in X (Twitter) composition drawer to draft and publish updates with a single click.

It is built with **zero external dependencies**—running on Python's built-in `http.server` and vanilla HTML/CSS/JavaScript.

---

## ✨ Features

- **Live RSS/Atom Feed Sync**: Fetches real-time release notes directly from Google Cloud.
- **Robust Offline Fallback**: Caches the XML data locally. If you lose connection or run in a restricted sandbox, the app falls back to the cache automatically.
- **Granular Classification**: Parses the raw feed content to separate and badge updates by category (e.g., `Feature`, `Announcement`, `Change`, `Issue`, `Breaking`).
- **Interactive Search & Filter**: Easily filter the feed using type chips or search for keywords in real-time.
- **X (Twitter) Draft Composer**: Select any update to open a floating compose drawer. The app handles stripping HTML, formatting the text, adding emojis, generating direct links, appending hashtags, and enforcing the 280-character limit with a visual progress ring.
- **Premium Dark UI**: Built with a glassmorphism theme, smooth animations, and tailored color palettes.

---

## 📂 Project Structure

```text
bigquery-release-notes/
├── server.py                 # Pure Python web server and feed parser
├── templates/
│   └── index.html            # Main markup and custom SVG assets
├── static/
│   ├── css/
│   │   └── style.css         # Glassmorphism, animations, and typography
│   └── js/
│       └── app.js            # Fetch controller, state, filters, and Tweet composer
├── release_notes_cache.xml   # Local copy of the XML feed (offline fallback)
└── README.md                 # Project documentation
```

---

## ⚙️ How to Run

1. Clone or download the project folder.
2. Navigate to the project directory:
   ```bash
   cd bigquery-release-notes
   ```
3. Start the Python web server:
   ```bash
   python3 server.py
   ```
4. Open your web browser and visit:
   ```text
   http://localhost:8000
   ```

---

## 🛠️ How it Works Under the Hood

### The Server Side
- **HTTP Server**: Subclasses `http.server.SimpleHTTPRequestHandler` to serve static pages on port `8000`.
- **Feed Fetcher**: Uses `urllib.request` to poll the XML feed. If it times out or fails, it falls back to the local `release_notes_cache.xml` file.
- **Regex Splitter**: Uses Python's standard `re` library to divide single-day updates by `<h3>` tags:
  ```python
  re.finditer(r'<h3>([^<]+)</h3>(.*?)(?=<h3>|$)', content_html, re.DOTALL)
  ```

### The Client Side
- **Rendering**: Groups release note cards dynamically under headers for each date.
- **Drafting Tweet Templates**: Strips HTML tags from descriptions, truncates the message safely below 280 characters, appends hashtags (`#BigQuery #GoogleCloud`), and generates web intents:
  ```text
  🚀 BigQuery Feature (June 15, 2026):
  "Use Gemini Cloud Assist to analyze SQL queries..."

  Details: https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026
  #BigQuery #GoogleCloud
  ```
- **X (Twitter) Intent**: Launces X's web intent system (`https://twitter.com/intent/tweet?text=...`) to post drafts instantly.
