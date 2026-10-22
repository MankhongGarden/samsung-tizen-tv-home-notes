function onOk(onTap, onHold, holdMs) {
  var timer = null;
  holdMs = holdMs || 650;

  document.addEventListener('keydown', function (ev) {
    if (ev.keyCode !== 13) return;
    ev.preventDefault();
    if (ev.repeat || timer) return;
    timer = setTimeout(function () { timer = null; onHold(); }, holdMs);
  });

  document.addEventListener('keyup', function (ev) {
    if (ev.keyCode !== 13) return;
    ev.preventDefault();
    if (timer) { clearTimeout(timer); timer = null; onTap(); }
  });
}
