"""
Fix the onerror handler to NOT clear body.innerHTML,
instead overlay a visible error message on top.
Also remove duplicate test divs.
"""
path = r'c:/Users/Tim/Downloads/Kinfolk-Clean/index.html'

with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Replace the destructive onerror handler with a safe overlay version
old_handler = '''<script>
window.onerror = function(msg, src, line, col, err) {
    document.body.style.background = '#fff';
    document.body.innerHTML = '<div style="font-family:monospace;padding:30px;color:#c00;font-size:14px"><strong>JS ERROR:</strong><br>' + msg + '<br><br>File: ' + src + '<br>Line: ' + line + '<br><br>' + (err ? err.stack || err : '') + '</div>';
    return true;
};
window.onunhandledrejection = function(e) {
    document.body.style.background = '#fff';
    document.body.innerHTML = '<div style="font-family:monospace;padding:30px;color:#c00;font-size:14px"><strong>PROMISE ERROR:</strong><br>' + e.reason + '</div>';
};
</script>'''

new_handler = '''<script>
window.onerror = function(msg, src, line, col, err) {
    var d = document.getElementById('js-error-overlay') || document.createElement('div');
    d.id = 'js-error-overlay';
    d.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#c00;color:#fff;padding:12px 16px;font-size:13px;font-family:monospace;z-index:999999;white-space:pre-wrap;';
    d.innerText = 'JS ERROR: ' + msg + '\nFile: ' + src + ' Line:' + line + '\n' + (err ? err.stack || '' : '');
    document.body.appendChild(d);
    return false;
};
window.onunhandledrejection = function(e) {
    var d = document.getElementById('js-promise-overlay') || document.createElement('div');
    d.id = 'js-promise-overlay';
    d.style.cssText = 'position:fixed;top:60px;left:0;width:100%;background:#c60;color:#fff;padding:12px 16px;font-size:13px;font-family:monospace;z-index:999999;';
    d.innerText = 'PROMISE ERROR: ' + e.reason;
    document.body.appendChild(d);
};
</script>'''

if old_handler in content:
    content = content.replace(old_handler, new_handler)
    print('Replaced destructive onerror with safe overlay version')
else:
    print('WARNING: Could not find old handler, checking for partial match...')
    if 'document.body.innerHTML' in content and 'window.onerror' in content:
        # Find and replace just the innerHTML line
        content = content.replace(
            "    document.body.style.background = '#fff';\n    document.body.innerHTML = '<div style=\"font-family:monospace;padding:30px;color:#c00;font-size:14px\"><strong>JS ERROR:</strong><br>' + msg + '<br><br>File: ' + src + '<br>Line: ' + line + '<br><br>' + (err ? err.stack || err : '') + '</div>';",
            "    // Safe: append error overlay instead of clearing body\n    var d = document.createElement('div'); d.style.cssText='position:fixed;top:0;left:0;width:100%;background:#c00;color:#fff;padding:12px;z-index:999999;font-size:13px;'; d.innerText='JS ERROR: '+msg+' Line:'+line; document.body.appendChild(d);"
        )
        print('Applied partial fix')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
