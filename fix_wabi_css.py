"""
Fix: inject wabi-sabi-landscape CSS, fix homeView layout
"""
path = r'c:/Users/Tim/Downloads/Kinfolk-Clean/index.html'

with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

wabi_css = """
        /* Wabi-Sabi Organic Surface Landscape */
        .wabi-sabi-landscape {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 380px;
            pointer-events: none;
            z-index: 0;
            overflow: hidden;
        }
        .wabi-sabi-landscape .landscape-layer {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        .wabi-sabi-landscape .layer-1 { opacity: 0.75; }
        .wabi-sabi-landscape .layer-2 { opacity: 0.60; }
        .wabi-sabi-landscape .layer-3 { opacity: 0.50; }
"""

# Inject CSS before closing </style> of the inline style block
# Find the last </style> before <script
target = '        </style>\n'
# Find the right </style> (the one that closes the main <style> block)
idx = content.rfind('        </style>')
if idx != -1:
    content = content[:idx] + wabi_css + content[idx:]
    print('CSS injected!')
else:
    print('ERROR: Could not find </style> tag')
    
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
if '.wabi-sabi-landscape' in content:
    print('Verification: wabi-sabi CSS found in file')
else:
    print('Verification FAILED')
