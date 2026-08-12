import subprocess
import sys

path = r'c:/Users/Tim/Downloads/Kinfolk-Clean/js/app.js'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

fixes = 0
for i, line in enumerate(lines):
    orig = line
    # Fix any garbled Chinese in showToast calls - replace with safe ASCII equivalent
    if 'showToast(' in line and '\ufffd' in line:
        if 'Synced' in line or 'Latest' in line:
            lines[i] = "            showToast('\u5df2\u540c\u6b65\u81f3\u6700\u65b0\u9032\u5ea6');\n"
            fixes += 1
            print(f"Line {i+1} fixed")
    if 'showToast(' in line and ('??' in line or '\ufffd' in line):
        if 'deleted' in line.lower() or '\u522a\u9664' in line:
            lines[i] = "                showToast('\u7b46\u8a18\u5df2\u522a\u9664');\n"
            fixes += 1
            print(f"Line {i+1} fixed")

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
    
print(f'Total fixes: {fixes}')
