// Pan, zoom and dragging for the whiteboard (plan §5.10, §5.11).
// Knows nothing about cards or areas: it moves and scales the world, and reports
// "this note was dropped on this zone at (x, y)". app.js decides what that means.
(function (root) {
  'use strict';

  const L = root.RetroLogic;

  const DRAG_THRESHOLD = 4;
  const GRID = 24;
  const FIT_MARGIN = 32;
  const FOCUS_MARGIN = 48;
  const FOCUS_MARGIN_BOTTOM = 96; // clears the floating zoom controls
  const WHEEL_ZOOM_SPEED = 0.005;
  const WHEEL_ZOOM_MAX_STEP = 40;
  const RETURN_MS = 250;
  const INTERACTIVE = 'button, textarea, input, select, a, label';

  // options:
  //   viewport, world   the whiteboard element and the element inside it that moves
  //   topInset()        height of anything floating over the top of the viewport
  //   onViewChange(view, byUser)
  //   canDrop(noteEl, zoneEl) -> boolean
  //   onDrop(noteEl, zoneEl, x, y)   x, y: the note's new top-left inside the zone, in world units
  function createCanvas({ viewport, world, topInset, onViewChange, canDrop, onDrop }) {
    let view = { zoom: 1, x: 0, y: 0 };
    let enabled = false;
    let gesture = null;
    let gestureStartZoom = 1;

    // --- View -----------------------------------------------------------------

    function apply() {
      if (!enabled) {
        world.style.transform = '';
        viewport.style.backgroundSize = '';
        viewport.style.backgroundPosition = '';
        return;
      }
      world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
      // The dot grid moves and scales with the world, like paper.
      const size = GRID * view.zoom;
      viewport.style.backgroundSize = `${size}px ${size}px`;
      viewport.style.backgroundPosition = `${view.x}px ${view.y}px`;
    }

    function setView(next, byUser = false) {
      view = next;
      apply();
      onViewChange(view, byUser);
    }

    function local(e) {
      const rect = viewport.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function zoomStep(direction) {
      const rect = viewport.getBoundingClientRect();
      const inset = topInset();
      const cx = rect.width / 2;
      const cy = inset + (rect.height - inset) / 2;
      setView(L.zoomAt(view, L.nextZoomStep(view.zoom, direction), cx, cy), true);
    }

    function fit(byUser = false) {
      const rect = viewport.getBoundingClientRect();
      const inset = topInset();
      const bounds = { x: 0, y: 0, width: world.offsetWidth, height: world.offsetHeight };
      const next = L.fitView(bounds, { width: rect.width, height: rect.height - inset }, FIT_MARGIN);
      setView({ ...next, y: next.y + inset }, byUser);
    }

    // Pans just enough to show `el` (used when keyboard focus lands outside the view).
    function panIntoView(el) {
      if (!enabled || !world.contains(el)) return;
      const r = el.getBoundingClientRect();
      const vp = viewport.getBoundingClientRect();
      const left = vp.left + FOCUS_MARGIN;
      const right = vp.right - FOCUS_MARGIN;
      const top = vp.top + topInset() + FOCUS_MARGIN / 2;
      const bottom = vp.bottom - FOCUS_MARGIN_BOTTOM;

      let dx = 0;
      if (r.left < left) dx = left - r.left;
      else if (r.right > right) dx = Math.max(right - r.right, left - r.left);
      let dy = 0;
      if (r.top < top) dy = top - r.top;
      else if (r.bottom > bottom) dy = Math.max(bottom - r.bottom, top - r.top);

      if (dx || dy) setView({ ...view, x: view.x + dx, y: view.y + dy });
    }

    function setEnabled(on) {
      enabled = on;
      if (!on) cancelGesture();
      apply();
    }

    // --- Pointer: pan on empty space, drag on notes ----------------------------

    function zoneAt(noteEl, clientX, clientY) {
      for (const zone of world.querySelectorAll('.drop-zone')) {
        const r = zone.getBoundingClientRect();
        const inside = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
        if (inside) return canDrop(noteEl, zone) ? zone : null;
      }
      return null;
    }

    function highlight(zone) {
      if (gesture.zone === zone) return;
      if (gesture.zone) gesture.zone.classList.remove('is-drop-target');
      if (zone) zone.classList.add('is-drop-target');
      gesture.zone = zone;
    }

    function onPointerDown(e) {
      if (!enabled || gesture || e.button !== 0) return;
      if (e.target.closest(INTERACTIVE)) return;
      const note = e.target.closest('[data-note-id]');
      // Notes are moved with a mouse (or pen) only; touch on a note does nothing (spec Story 9.5).
      if (note && e.pointerType === 'touch') return;

      e.preventDefault();
      gesture = note
        ? { type: 'note', note, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dragging: false, zone: null }
        : { type: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startView: view };
      viewport.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;

      if (gesture.type === 'pan') {
        viewport.classList.add('is-panning');
        setView({ ...gesture.startView, x: gesture.startView.x + dx, y: gesture.startView.y + dy }, true);
        return;
      }

      if (!gesture.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        const rect = gesture.note.getBoundingClientRect();
        gesture.dragging = true;
        gesture.grabX = gesture.startX - rect.left;
        gesture.grabY = gesture.startY - rect.top;
        gesture.note.classList.add('is-dragging');
      }
      // The note lives inside the scaled world, so screen pixels are divided by the zoom.
      gesture.note.style.transform = `translate(${dx / view.zoom}px, ${dy / view.zoom}px)`;
      highlight(zoneAt(gesture.note, e.clientX, e.clientY));
    }

    function onPointerUp(e) {
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      const g = gesture;
      endGesture();
      if (g.type !== 'note' || !g.dragging) return;

      const zone = zoneAt(g.note, e.clientX, e.clientY);
      if (!zone) {
        slideBack(g.note);
        return;
      }
      const r = zone.getBoundingClientRect();
      const x = (e.clientX - g.grabX - r.left) / view.zoom - zone.clientLeft;
      const y = (e.clientY - g.grabY - r.top) / view.zoom - zone.clientTop;
      onDrop(g.note, zone, x, y);
    }

    function endGesture() {
      if (!gesture) return;
      if (gesture.zone) gesture.zone.classList.remove('is-drop-target');
      if (viewport.hasPointerCapture(gesture.pointerId)) viewport.releasePointerCapture(gesture.pointerId);
      viewport.classList.remove('is-panning');
      gesture = null;
    }

    function cancelGesture() {
      if (gesture && gesture.type === 'note' && gesture.dragging) slideBack(gesture.note);
      endGesture();
    }

    function slideBack(note) {
      note.classList.add('is-returning');
      note.style.transform = '';
      setTimeout(() => note.classList.remove('is-dragging', 'is-returning'), RETURN_MS);
    }

    // --- Wheel, trackpad and Safari pinch -------------------------------------

    function onWheel(e) {
      if (!enabled) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientHeight : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;

      if (e.ctrlKey || e.metaKey) {
        // Chrome and Firefox report a trackpad pinch as Ctrl + wheel.
        const step = Math.max(-WHEEL_ZOOM_MAX_STEP, Math.min(WHEEL_ZOOM_MAX_STEP, dy));
        const p = local(e);
        setView(L.zoomAt(view, view.zoom * Math.exp(-step * WHEEL_ZOOM_SPEED), p.x, p.y), true);
      } else {
        setView({ ...view, x: view.x - dx, y: view.y - dy }, true);
      }
    }

    function onGestureStart(e) {
      if (!enabled) return;
      e.preventDefault();
      gestureStartZoom = view.zoom;
    }

    function onGestureChange(e) {
      if (!enabled) return;
      e.preventDefault();
      const p = local(e);
      setView(L.zoomAt(view, gestureStartZoom * e.scale, p.x, p.y), true);
    }

    // The browser scrolls the viewport itself when something inside it gets focus.
    // Turn that scroll into a pan, so the world only ever moves by its transform.
    function onScroll() {
      const sx = viewport.scrollLeft;
      const sy = viewport.scrollTop;
      if (!sx && !sy) return;
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
      if (enabled) setView({ ...view, x: view.x - sx, y: view.y - sy });
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && gesture && gesture.dragging) {
        e.preventDefault();
        e.stopPropagation();
        cancelGesture();
      }
    }

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', cancelGesture);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('gesturestart', onGestureStart);
    viewport.addEventListener('gesturechange', onGestureChange);
    viewport.addEventListener('scroll', onScroll);
    world.addEventListener('focusin', (e) => requestAnimationFrame(() => panIntoView(e.target)));
    document.addEventListener('keydown', onKeyDown, true);

    return {
      getView: () => view,
      setView,
      setEnabled,
      zoomStep,
      fit,
      panIntoView,
    };
  }

  root.RetroCanvas = { createCanvas };
})(typeof globalThis !== 'undefined' ? globalThis : this);
