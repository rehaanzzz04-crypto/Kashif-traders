from pathlib import Path
import re,json
root=Path(__file__).resolve().parent.parent
assets=set()
for p in root.glob('*'):
    if p.suffix in ('.html','.js','.css','.png','.svg','.webmanifest') and not p.name.endswith('-core.js') and p.name not in ('sw.js','offline-shell-manifest.js'):
        assets.add('/'+p.name)
for p in root.glob('*.html'):
    for url in re.findall(r'(?:src|href)=[\"\'](/[^\"\']+)',p.read_text()):
        if not url.startswith('/api/') and (root/url.split('?')[0][1:]).is_file(): assets.add(url)
(root/'offline-shell-manifest.js').write_text('/* Static assets only. Regenerate using scripts/build-offline-manifest.py. */\nself.KT_SHELL_ASSETS = '+json.dumps(sorted(assets),indent=2)+';\n')
