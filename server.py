import http.server
import socketserver
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import json
import re
import os
import sys

PORT = 8000
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "release_notes_cache.xml"

class ReleaseNotesHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Route requests
        if self.path == '/' or self.path == '/index.html':
            self.serve_html_file('templates/index.html')
        elif self.path == '/api/release-notes':
            self.handle_api()
        else:
            # Delegate to SimpleHTTPRequestHandler for static assets (js, css)
            super().do_GET()

    def serve_html_file(self, filepath):
        try:
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', len(content))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, f'File not found: {filepath}')

    def handle_api(self):
        xml_data = None
        source_used = "live"

        print(f"Fetching release notes feed from: {FEED_URL}")
        try:
            # Fetch the live XML feed with a user-agent header and 10 second timeout
            req = urllib.request.Request(
                FEED_URL,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AntigravityReleaseNotesHub/1.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read()
                
            # Update cache file with successfully fetched live XML
            try:
                with open(CACHE_FILE, 'wb') as f:
                    f.write(xml_data)
                print("Live feed successfully fetched and cached locally.")
            except Exception as cache_err:
                print(f"Warning: Could not save feed to cache file: {cache_err}")

        except Exception as fetch_err:
            print(f"Network fetch failed: {fetch_err}. Attempting fallback to cache.")
            source_used = "cache"
            
            # Fallback to local cache file
            if os.path.exists(CACHE_FILE):
                try:
                    with open(CACHE_FILE, 'rb') as f:
                        xml_data = f.read()
                    print("Successfully loaded offline cache feed.")
                except Exception as cache_read_err:
                    self.send_api_error(500, f"Cache read error: {str(cache_read_err)}")
                    return
            else:
                self.send_api_error(503, f"Service Unavailable: Live feed failed and no local cache was found. Error: {str(fetch_err)}")
                return

        # Parse XML data and prepare JSON response
        try:
            root = ET.fromstring(xml_data)
            
            # Atom Namespaces helper
            atom_ns = '{http://www.w3.org/2005/Atom}'
            
            entries_list = []
            
            # Extract entry elements
            for entry in root.findall(f'{atom_ns}entry'):
                title_elem = entry.find(f'{atom_ns}title')
                date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
                
                updated_elem = entry.find(f'{atom_ns}updated')
                updated_timestamp = updated_elem.text.strip() if updated_elem is not None else ""
                
                link_elem = entry.find(f'{atom_ns}link')
                link_url = ""
                if link_elem is not None:
                    link_url = link_elem.attrib.get('href', '').strip()
                
                content_elem = entry.find(f'{atom_ns}content')
                content_html = content_elem.text if content_elem is not None else ""
                
                # Parse content HTML into individual release note objects
                notes = []
                if content_html:
                    # Match <h3>Type</h3> followed by content descriptions (until the next <h3> or end of string)
                    matches = list(re.finditer(r'<h3>([^<]+)</h3>(.*?)(?=<h3>|$)', content_html, re.DOTALL))
                    if matches:
                        for match in matches:
                            note_type = match.group(1).strip()
                            note_description = match.group(2).strip()
                            notes.append({
                                'type': note_type,
                                'description': note_description
                            })
                    else:
                        # Fallback for plain formatted descriptions without h3 separators
                        notes.append({
                            'type': 'General',
                            'description': content_html.strip()
                        })
                
                entries_list.append({
                    'date': date_str,
                    'updated': updated_timestamp,
                    'link': link_url,
                    'notes': notes
                })

            # Determine feed update time
            feed_updated_elem = root.find(f'{atom_ns}updated')
            feed_updated_time = feed_updated_elem.text.strip() if feed_updated_elem is not None else ""

            response_payload = {
                'status': 'success',
                'source': source_used,
                'feed_last_updated': feed_updated_time,
                'entries': entries_list
            }

            response_bytes = json.dumps(response_payload).encode('utf-8')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', len(response_bytes))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response_bytes)

        except Exception as parse_err:
            print(f"Error parsing feed XML: {parse_err}")
            self.send_api_error(500, f"Parser error processing feed XML: {str(parse_err)}")

    def send_api_error(self, code, message):
        response_payload = {
            'status': 'error',
            'message': message
        }
        response_bytes = json.dumps(response_payload).encode('utf-8')
        
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(response_bytes))
        self.end_headers()
        self.wfile.write(response_bytes)


# Configure server and run
def run():
    # Change working directory to script location to ensure relative paths resolve correctly
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Enable socket re-use to prevent 'Address already in use' errors
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), ReleaseNotesHandler) as httpd:
        print(f"\n=======================================================")
        print(f"🚀 BigQuery Release Notes Web Server started!")
        print(f"👉 Local URL: http://localhost:{PORT}")
        print(f"📂 Serving from: {script_dir}")
        print(f"=======================================================\n")
        print("Press Ctrl+C to stop the server.")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down web server. Goodbye!")
            sys.exit(0)

if __name__ == '__main__':
    run()
