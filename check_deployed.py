import urllib.request
url = 'https://tinyu070226-stack.github.io/Kinfolk/'
try:
    with urllib.request.urlopen(url, timeout=10) as r:
        content = r.read().decode('utf-8', errors='replace')
        print('HTTP Status:', r.status)
        print('page-load-test found:', 'page-load-test' in content)
        print('wabi-sabi-landscape CSS found:', 'position: fixed' in content and 'wabi-sabi' in content)
        print('display:flex!important found:', 'flex!important' in content)
        # Find the title
        import re
        title_match = re.search(r'<title>(.*?)</title>', content)
        if title_match:
            print('Title:', title_match.group(1))
        # Show first 200 chars of body content
        body_start = content.find('<body>')
        if body_start != -1:
            print('Body starts at:', body_start)
            print('Body preview:', content[body_start:body_start+200])
except Exception as e:
    print('Error:', e)
