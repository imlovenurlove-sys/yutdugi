# index.html이 원본. engine.js를 페이지 안 엔진 자리에 넣고, 아티팩트(오프라인)판을 만든다.
import re, sys
src = open('index.html', encoding='utf-8').read()
eng = open('engine.js', encoding='utf-8').read().strip()
start = src.index('<script>/* 윷두기 규칙 엔진')
end = src.index('</script>', start)
web = src[:start] + '<script>' + eng + '\n' + src[end:]
open('index.html', 'w', encoding='utf-8').write(web)
# 아티팩트판: 문서 껍데기·온라인 모듈·서버 주소를 뺀다(혼자/둘이 두기 전용)
art = web
art = art[art.index('<title>'):]
art = art.replace('</head><body>', '', 1).replace('</body></html>', '')
art = art.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js" crossorigin="anonymous"></script>\n', '')
art = re.sub(r"const SUPA_URL = '[^']*', SUPA_KEY = '[^']*';", "const SUPA_URL = '', SUPA_KEY = '';", art)
open('artifact.html', 'w', encoding='utf-8').write(art)
print('web', len(web), 'artifact', len(art), 'supabase-in-art', 'supabase.co' in art)
