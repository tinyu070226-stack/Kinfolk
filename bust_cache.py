"""
Add cache-busting version parameter to all JS script src tags in index.html
"""
import time

path = r'c:/Users/Tim/Downloads/Kinfolk-Clean/index.html'
version = str(int(time.time()))

with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Add version parameter to JS files
content = content.replace('<script src="js/canvas.js">', f'<script src="js/canvas.js?v={version}">')
content = content.replace('<script src="js/sync.js">', f'<script src="js/sync.js?v={version}">')
content = content.replace('<script src="js/export.js">', f'<script src="js/export.js?v={version}">')
content = content.replace('<script src="js/app.js">', f'<script src="js/app.js?v={version}">')

# Also add version to sw.js registration
content = content.replace("navigator.serviceWorker.register('sw.js')", f"navigator.serviceWorker.register('sw.js?v={version}')")

# Add a visible test div BEFORE body close to confirm HTML loads
test_div = f'''
<div id="page-load-test" style="position:fixed;top:0;left:0;width:100%;background:#2d2b2a;color:#f7f5f0;padding:8px 16px;font-size:12px;font-family:monospace;z-index:99999;pointer-events:none;">
  Kinfolk OS loading... v{version}
</div>
'''
content = content.replace('</body>', test_div + '</body>')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Done! Version: {version}')
print('All JS files now have cache-busting version parameter')
