import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width":1440,"height":1000}, locale=sys.argv[1])
        pg = await ctx.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/atlas/localtest/index.html"); await pg.wait_for_timeout(1500)
        inp = pg.locator('#heroField input')
        await inp.scroll_into_view_if_needed(); await inp.click(); await inp.type(sys.argv[2], delay=60)
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=sys.argv[3])
        await pg.keyboard.press('/') 
        await pg.goto("file:///home/claude/atlas/localtest/index.html#rf"); await pg.wait_for_timeout(800)
        await pg.keyboard.press('/'); await pg.wait_for_timeout(300)
        await pg.keyboard.type(sys.argv[2], delay=50); await pg.wait_for_timeout(400)
        await pg.screenshot(path=sys.argv[3].replace('.png','_ix.png'))
        print(errs or 'no errors')
        await b.close()
asyncio.run(main())
