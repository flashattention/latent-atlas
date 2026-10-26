"""Assemble dist/: index.html, static/* (favicons), js/ (code), i18n/<lang>.js (text), js/base.js (formulas + code).
Inputs:
  content/en/part*.json        {id: {n,d,f,u,x,c}}
  content/en/ui.json           UI strings (English)
  content/<lang>/items*.json   {id: {n,d,u,x}}   (translations, any number of chunk files)
  content/<lang>/ui.json       {"ui": {...}, "cats": {...}}
  content/legend.json          {"en": [...strings], "<lang>": {en_string: translated}}
"""
import json, glob, os, shutil, re, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')
LANGS = ['ko', 'en', 'es', 'zh', 'ja', 'fr', 'de', 'pt', 'ru', 'ar', 'hi', 'it']

def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)

def registry():
    src = open(os.path.join(ROOT, 'src/registry.js'), encoding='utf-8').read()
    ids = re.findall(r"^\['([a-z0-9]+)','([a-z]+)','([^']+)'", src, re.M)
    cats = re.findall(r"\['([a-z]+)','([^']+)'\]", src.split('items:')[0])
    return ids, cats

def main():
    ids, cats = registry()
    idset = [i[0] for i in ids]
    en = {}
    for p in sorted(glob.glob(os.path.join(ROOT, 'content/en/part*.json'))):
        en.update(load(p))
    missing = [i for i in idset if i not in en]
    if missing:
        print('EN missing', len(missing), missing[:10])
    os.makedirs(os.path.join(DIST, 'js'), exist_ok=True)
    os.makedirs(os.path.join(DIST, 'i18n'), exist_ok=True)
    base = {'f': {}, 'c': {}}
    for i in idset:
        e = en.get(i)
        if not e: continue
        if e.get('f'): base['f'][i] = e['f']
        if e.get('c'): base['c'][i] = e['c']
    with open(os.path.join(DIST, 'js/base.js'), 'w', encoding='utf-8') as f:
        f.write('window.ATLAS_BASE=' + json.dumps(base, ensure_ascii=False, separators=(',', ':')) + ';\n')
    legend = {}
    for p in glob.glob(os.path.join(ROOT, 'content/legend_*.json')):
        lg = os.path.basename(p)[7:-5]
        if lg != 'en': legend[lg] = load(p)
    en_ui = load(os.path.join(ROOT, 'content/en/ui.json'))
    report = {}
    for lg in LANGS:
        if lg == 'en':
            items = {i: {k: en[i][k] for k in ('n', 'd', 'u', 'x') if k in en[i]} for i in idset if i in en}
            data = {'ui': en_ui, 'cats': {c: n for c, n in cats}, 'items': items, 'legend': {}}
        else:
            d = os.path.join(ROOT, 'content', lg)
            items = {}
            for p in sorted(glob.glob(os.path.join(d, 'items*.json'))):
                items.update(load(p))
            uip = os.path.join(d, 'ui.json')
            u = load(uip) if os.path.exists(uip) else {}
            data = {'ui': u.get('ui', {}), 'cats': u.get('cats', {}), 'items': {i: items[i] for i in idset if i in items}, 'legend': legend.get(lg, {})}
        report[lg] = len(data['items'])
        with open(os.path.join(DIST, 'i18n', lg + '.js'), 'w', encoding='utf-8') as f:
            f.write('__ATLAS_SET(' + json.dumps(lg) + ',' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ');\n')
    for name in ['core', 'registry', 'viz-a', 'viz-b', 'viz-c', 'viz-d', 'viz-e', 'stage', 'flags', 'app']:
        src = os.path.join(ROOT, 'src', name + '.js')
        if os.path.exists(src):
            shutil.copy(src, os.path.join(DIST, 'js', name + '.js'))
        else:
            open(os.path.join(DIST, 'js', name + '.js'), 'w').write('/* pending */\n')
    shutil.copy(os.path.join(ROOT, 'index.html'), os.path.join(DIST, 'index.html'))
    for p in glob.glob(os.path.join(ROOT, 'static', '*')):
        shutil.copy(p, os.path.join(DIST, os.path.basename(p)))
    print('items per language:', report)

if __name__ == '__main__':
    main()
