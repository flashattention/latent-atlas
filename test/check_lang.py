import json, glob, re, os, sys
R = {'ko': r'[가-힣]', 'ja': r'[぀-ヿ]', 'zh': r'[一-鿿]', 'ru': r'[Ѐ-ӿ]', 'ar': r'[؀-ۿ]', 'hi': r'[ऀ-ॿ]'}
LAT = {'es': ['ñ', ' el ', ' los ', ' una ', ' para '], 'fr': [' le ', ' les ', ' des ', ' une ', ' est '], 'de': [' der ', ' die ', ' und ', ' das ', ' ist '], 'pt': [' não ', ' uma ', ' para ', ' dos ', ' ção'], 'it': [' il ', ' gli ', ' della ', ' una ', ' è ']}
ids = {}  # items<n>.json must cover the ids of content/en/part<n>.json
for p in glob.glob('content/en/part*.json'):
    ids[int(re.findall(r'part(\d+)', p)[0])] = list(json.load(open(p, encoding='utf-8')))
for lang in ['ko','es','zh','ja','fr','de','pt','ru','ar','hi','it']:
    for p in sorted(glob.glob(f'content/{lang}/items*.json')):
        n = int(re.findall(r'items(\d+)', p)[0])
        try: d = json.load(open(p, encoding='utf-8'))
        except Exception as e: print(p, 'BAD JSON', e); continue
        miss = [i for i in ids.get(n, []) if i not in d]
        bad = []
        for i, e in d.items():
            txt = e.get('d', '')
            if lang in R:
                if len(re.findall(R[lang], txt)) < 20: bad.append(i)
            else:
                low = ' ' + txt.lower() + ' '
                hits = sum(low.count(w) for w in LAT[lang])
                others = {k: sum(low.count(w) for w in v) for k, v in LAT.items() if k != lang}
                if hits < 2 or max(others.values()) > hits * 1.5 or re.search(r'[Ѐ-ӿ가-힣一-鿿]', txt): bad.append(i)
        extra=[i for i in d if i not in ids.get(n,[])]
        print(p, len(d), 'missing', len(miss), 'extra', len(extra), 'suspect', len(bad), bad[:5])
