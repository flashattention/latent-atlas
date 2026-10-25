import asyncio, sys, os
from playwright.async_api import async_playwright
url = sys.argv[1]; out = sys.argv[2]; w = int(sys.argv[3]) if len(sys.argv)>3 else 1440; h=int(sys.argv[4]) if len(sys.argv)>4 else 900
lang = sys.argv[5] if len(sys.argv)>5 else 'en-US'
full = '--full' in sys.argv
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist","--allow-file-access-from-files"])
        ctx = await b.new_context(viewport={"width":w,"height":h}, locale=lang)
        pg = await ctx.new_page()
        logs=[]
        pg.on("console", lambda m: logs.append(m.type+": "+m.text) if m.type in ("error","warning") else None)
        pg.on("pageerror", lambda e: logs.append("PAGEERROR "+str(e)))
        await pg.goto(url); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=out, full_page=full)
        print("\n".join(logs[:15]) or "no errors")
        await b.close()
asyncio.run(main())
