import urllib.request
import json
import os

with open('bundled.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

data = json.dumps({'html': html_content, 'ttl': '30d'}).encode('utf-8')
req = urllib.request.Request('https://pagedrop.io/api/upload', data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print('URL:', result.get('url', result))
except Exception as e:
    print('Error:', e)
