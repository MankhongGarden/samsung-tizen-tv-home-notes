var Platform = (function () {
  var isTV = typeof window.tizen !== 'undefined';
  var KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'enter', 10009: 'back', 8: 'back', 27: 'back' };
  var SAMSUNG_HOME = 'com.samsung.tv.csfs';
  var TV_VIEWER = 'org.tizen.tv-viewer';

  var STORE_ID = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/;
  var NUMERIC_ID = /^\d{9,13}$/;
  var PRELOADED = ['org.tizen.netflix-app', 'org.tizen.primevideo', 'org.tizen.apple.apple-music', 'org.tizen.browser', 'com.samsung.tv.aria-video'];
  var INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual', 'ZODRT12q2l.WebAccountExtension',
    'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices', '2022ePop01.SmartTV', 'w2VwCK465D.OTApp', 'J9fZJDMi1v.SecurityCenter'];
  var NOISE = /service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon|dummy|agent|e-?manual|account|adplayer|privacy|security/i;

  function withTimeout(fn, ms, what) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error(what + ' did not respond')); }, ms);
      try {
        fn(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
      } catch (e) { clearTimeout(timer); reject(e); }
    });
  }

  function selfId() {
    try { return tizen.application.getCurrentApplication().appInfo.id; } catch (e) { return null; }
  }

  function isConsumer(a) {
    if (PRELOADED.indexOf(a.id) >= 0) return true;
    if (!a.show || INTERNAL.indexOf(a.id) >= 0) return false;
    if (!STORE_ID.test(a.id) && !NUMERIC_ID.test(a.id)) return false;
    return !NOISE.test(a.name + ' ' + a.id);
  }

  function shortName(name) { return name.split(/\s+[-:|–]\s+/)[0].trim() || name; }

  function tvGetApps() {
    return withTimeout(function (ok, err) { tizen.application.getAppsInfo(ok, err); }, 8000, 'App list').then(function (apps) {
      var self = selfId(), seen = {};
      return apps.filter(function (a) {
        if (!a.name || a.id === self || seen[a.id] || !isConsumer(a)) return false;
        seen[a.id] = true; return true;
      }).map(function (a) {
        return { id: a.id, name: shortName(a.name), icon: a.iconPath || '' };
      }).sort(function (x, y) { return x.name.localeCompare(y.name); });
    });
  }

  function tvLaunch(id) {
    return withTimeout(function (ok, err) { tizen.application.launch(id, ok, err); }, 8000, 'App launch');
  }

  function tvLaunchControl(appId, spec) {
    return withTimeout(function (ok, err) {
      var data = (spec.data || []).map(function (d) { return new tizen.ApplicationControlData(d[0], [d[1]]); });
      var ctl = new tizen.ApplicationControl(spec.op || 'http://tizen.org/appcontrol/operation/default', spec.uri || null, null, null, data);
      tizen.application.launchAppControl(ctl, appId, function () { ok(); }, err);
    }, 9000, 'App control launch');
  }

  function openPrimeTitle(gti) {
    return tvLaunchControl('org.tizen.primevideo', { data: [['PAYLOAD', JSON.stringify({ values: gti })]] });
  }

  function videoSources() {
    return withTimeout(function (ok, err) { tizen.systeminfo.getPropertyValue('VIDEOSOURCE', ok, err); }, 8000, 'Video sources');
  }

  function tvGetSources() {
    return videoSources().then(function (info) {
      return (info.connected || []).filter(function (s) { return s.type === 'HDMI'; }).map(function (s) {
        return { id: 'HDMI' + s.number, number: s.number, label: 'HDMI ' + s.number };
      });
    }).catch(function () { return []; });
  }

  function tvSwitchSource(s) {
    return videoSources().then(function (info) {
      var all = (info.connected || []).concat(info.disconnected || []);
      var src = null;
      for (var i = 0; i < all.length; i++) if (all[i].type === 'HDMI' && all[i].number === s.number) src = all[i];
      if (!src) throw new Error('TV has no ' + s.label);
      return withTimeout(function (ok, err) { tizen.tvwindow.setSource(src, ok, err, 'MAIN'); }, 8000, 'Source switch');
    }).then(function () { return tvLaunch(TV_VIEWER); });
  }

  var MOCK_APPS = [
    { id: 'mock.netflix', name: 'Netflix' }, { id: 'mock.youtube', name: 'YouTube' },
    { id: 'mock.prime', name: 'Prime Video' }, { id: 'mock.browser', name: 'Internet' }
  ];
  function mock(msg) { return function (x) { console.log('[mock] ' + msg, x && x.id || x || ''); return Promise.resolve(); }; }

  return {
    isTV: isTV,
    keyName: function (ev) { return KEYS[ev.keyCode] || null; },
    getApps: isTV ? tvGetApps : function () { return Promise.resolve(MOCK_APPS); },
    getSources: isTV ? tvGetSources : function () { return Promise.resolve([{ id: 'HDMI1', number: 1, label: 'HDMI 1' }]); },
    launch: isTV ? tvLaunch : mock('launch'),
    launchControl: isTV ? tvLaunchControl : mock('launchControl'),
    openPrimeTitle: isTV ? openPrimeTitle : mock('open Prime title'),
    switchSource: isTV ? tvSwitchSource : mock('switch source'),
    openSamsungHome: isTV ? function () { return tvLaunch(SAMSUNG_HOME); } : mock('open Samsung home')
  };
})();
