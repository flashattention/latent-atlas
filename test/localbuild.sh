#!/bin/bash
python3 build.py >/dev/null && rm -rf localtest && cp -r dist localtest && mkdir -p localtest/vendor && cp -r test/node_modules/three localtest/vendor/ && sed -i 's#https://cdn.jsdelivr.net/npm/three@0.128.0/#vendor/three/#g' localtest/index.html
