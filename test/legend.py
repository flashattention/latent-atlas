import asyncio, json, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width":600,"height":400})
        await pg.goto("file://"+os.path.abspath("harness.html")); await pg.wait_for_timeout(400)
        items = await pg.evaluate("ATLAS_REG.items.map(x=>x[0])")
        S=set(); per={}
        for i in items:
            info = await pg.evaluate(f"showItem('{i}')")
            per[i]=[l['t'] for l in info['legend']]
            S.update(per[i])
        json.dump(sorted(S), open('../content/legend_en.json','w'), ensure_ascii=False, indent=1)
        print(len(S), 'strings;', sum(1 for v in per.values() if not v), 'items without legend')
        await b.close()
asyncio.run(main())
