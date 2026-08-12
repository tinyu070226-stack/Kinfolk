path = r'c:/Users/Tim/Downloads/Kinfolk-Clean/index.html'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

error_script = '''<script>
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

# Inject before first <script src=
html = html.replace('<script src="js/canvas.js">', error_script + '\n    <script src="js/canvas.js">', 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print('Injected error handler!')
