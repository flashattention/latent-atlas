/* Latent Atlas — stage: one WebGL renderer, orbit controls, auto-framing, parameter state.
   Usage: const st = AtlasStage(canvasEl); st.show(item, onControls) where item = {id, type, params}.
   onControls(ctlList, values, setValue) lets the page render sliders/selects. */
(function () {
  const K = window.ATLAS_K;
  window.AtlasStage = function (canvas, opts = {}) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.8; controls.enablePan = false;
    controls.autoRotate = !opts.still; controls.autoRotateSpeed = 0.55;
    let idleTimer = null;
    controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleTimer); });
    controls.addEventListener('end', () => { clearTimeout(idleTimer); if (!opts.still && !reduce()) idleTimer = setTimeout(() => { controls.autoRotate = true; }, 6000); });
    const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce()) controls.autoRotate = false;

    let cur = null, curItem = null, values = {}, built = null, t0 = performance.now(), last = t0, framedOnce = false;
    let intro = 0, fitK = 0.86;

    function size() {
      const w = canvas.clientWidth || 600, h = canvas.clientHeight || 400;
      if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
      }
      camera.aspect = w / h; camera.updateProjectionMatrix();
      K.setRes(w, h);
    }

    function disposeObj(o) {
      o.traverse((c) => {
        if (c.geometry && !c.geometry.__shared) c.geometry.dispose && c.geometry.dispose();
        if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
      });
    }

    function frame(group, keepView) {
      const box = new THREE.Box3().setFromObject(group);
      if (box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      group.position.sub(c);
      if (keepView) return;
      // bounding-sphere fit so the figure stays inside the frame from any orbit angle
      const R = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z) * 0.5;
      const vfov = camera.fov * Math.PI / 180;
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(camera.aspect, 0.5));
      const dist = R / Math.sin(Math.min(vfov, hfov) / 2) * fitK + 0.3;
      const dir = new THREE.Vector3(1.0, 0.62, 1.25).normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.35; controls.maxDistance = dist * 2.6;
      controls.update();
    }

    function build(keepView) {
      size();
      if (cur) { scene.remove(cur); disposeObj(cur); }
      K.forget();
      const fn = window.VIZ[curItem.type];
      const p = Object.assign({}, curItem.params || {}, values);
      let res;
      try {
        res = fn ? fn(p, K) : null;
      } catch (e) { console.error('[viz]', curItem.id, e); res = null; }
      if (!res || !res.g) {
        res = { g: new THREE.Group() };
        res.g.add(K.box(0, 0, 0, 3, 3, 3, { o: 0.4 }));
        res.g.add(K.label(curItem.type, [0, 0, 0], { size: 0.4 }));
      }
      built = res;
      const holder = new THREE.Group(); holder.add(res.g);
      cur = holder; scene.add(holder);
      frame(holder, keepView);
      return res;
    }

    function show(item, onControls, o) {
      curItem = item; values = {}; fitK = (o && o.fit) || 0.86;
      const res = build(false);
      intro = reduce() ? 1 : 0;
      // seed control values from the builder's declared defaults
      (res.ctl || []).forEach((c) => { values[c.key] = c.value; });
      emit(onControls);
      return res;
    }

    function emit(onControls) {
      if (!onControls || !built) return;
      onControls(built.ctl || [], Object.assign({}, values), (key, v) => {
        values[key] = v;
        build(true);
        if (built.ctl) built.ctl.forEach((c) => { if (!(c.key in values)) values[c.key] = c.value; });
        if (onControls.after) onControls.after(built, Object.assign({}, values));
      });
    }

    function resetView() { if (cur) { const keep = values; frame(cur, false); values = keep; } }

    let raf = 0, running = true;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      size();
      if (intro < 1) { intro = Math.min(1, intro + dt * 1.6); if (cur) { const e = K.ease(intro); cur.scale.setScalar(0.92 + 0.08 * e); cur.rotation.y = (1 - e) * -0.35; } }
      if (built && built.tick) { try { built.tick((now - t0) / 1000, dt); } catch (e) { built.tick = null; console.error(e); } }
      scene.traverse((o) => { if (o.userData.billboard) o.quaternion.copy(camera.quaternion); });
      controls.update();
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    return {
      show, resetView, renderer, camera, controls,
      pause() { running = false; }, resume() { running = true; last = performance.now(); },
      renderOnce() { size(); controls.update(); renderer.render(scene, camera); },
      values: () => Object.assign({}, values),
    };
  };
})();
