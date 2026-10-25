# usage: python3 run.py <types comma-separated|all> [--ctl]  -> screenshots in shots/, prints errors
import sys, json, asyncio
from playwright.async_api import async_playwright
types = sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width":900,"height":600})
        logs=[]
        pg.on("console", lambda m: logs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror", lambda e: logs.append("PAGEERROR "+str(e)))
        import os
        await pg.goto("file://"+os.path.abspath("harness.html"))
        await pg.wait_for_timeout(500)
        items = await pg.evaluate("ATLAS_REG.items.map(x=>[x[0],x[3]])")
        sel = [i for i,t in items if types=="all" or t in types.split(",")]
        for iid in sel:
            logs.clear()
            info = await pg.evaluate(f"showItem('{iid}')")
            await pg.wait_for_timeout(120)
            await pg.evaluate("tick()")
            await pg.locator("#c").screenshot(path=f"shots/{iid}.png")
            if "--ctl" in sys.argv:
                for c in info["ctl"]:
                    vals = c["options"] if c.get("options") else [c["min"], c["max"]]
                    for v in vals:
                        vv = v["value"] if isinstance(v,dict) else v
                        await pg.evaluate("([k,v])=>setCtl(k,v)", [c["key"], vv])
                    await pg.evaluate("([k,v])=>setCtl(k,v)", [c["key"], c["value"]])
            print(iid, info["type"], "ctl=",[c["key"] for c in info["ctl"]], ("ERRORS: "+" | ".join(logs[:3])) if logs else "ok")
        await b.close()
asyncio.run(main())
