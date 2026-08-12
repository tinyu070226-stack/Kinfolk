"""
Build a clean diagnostic index.html to test if the page renders at all.
"""
path = r'c:/Users/Tim/Downloads/Kinfolk-Clean/index.html'

with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Check if the debug script is already there
has_debug = 'window.onerror' in content
print(f'Debug handler present: {has_debug}')

# Check homeView has active class
has_active = 'id="homeView" class="app-view active"' in content
print(f'homeView has active class: {has_active}')

# Check styles.css link
has_css = 'css/styles.css' in content
print(f'styles.css linked: {has_css}')

# Check script order
canvas_pos = content.find('canvas.js')
sync_pos = content.find('sync.js')
export_pos = content.find('export.js')
app_pos = content.find('app.js')
print(f'Script order: canvas={canvas_pos}, sync={sync_pos}, export={export_pos}, app={app_pos}')
print(f'Order is correct (ascending): {canvas_pos < sync_pos < export_pos < app_pos}')

# Print lines around homeView
for i, line in enumerate(content.split('\n')):
    if 'homeView' in line and 'div' in line:
        print(f'Line {i}: {line.strip()}')
