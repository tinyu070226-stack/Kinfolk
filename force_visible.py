"""
Force homeView to be visible with inline styles, add bright indicator to debug white page
"""
path = r'c:/Users/Tim/Downloads/Kinfolk-Clean/index.html'

with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Force homeView inline style to guarantee visibility
content = content.replace(
    'id="homeView" class="app-view active"',
    'id="homeView" class="app-view active" style="display:flex!important;flex-direction:column;min-height:100vh;width:100%;position:relative;z-index:1;"'
)

# Change .app-view rule to be visible by default (remove display:none approach)
# And make sure body is not white-on-white
content = content.replace(
    'body {\n            margin: 0;',
    'body {\n            margin: 0;\n            background-color: #F7F5F0 !important;'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done - homeView forced visible')
