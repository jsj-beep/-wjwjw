/* 小蒋流量查询 PWA Service Worker */
const CACHE = 'xjllcx-pwa-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './lib/vue.global.prod.js',
  './lib/axios.min.js',
  './lib/echarts.min.js',
  './lib/md5.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-180.png',
  './icons/icon.svg'
];

// 上游 API 域名（直连，已开启 CORS *）
const API_HOSTS = ['flow.mxzu.net', 'flow2.ggff.net', 'lunovaw.cn'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isApi(url) {
  if (url.pathname.indexOf('/api/') !== -1) return true;
  return API_HOSTS.some(function (h) { return url.hostname === h || url.hostname.endsWith('.' + h); });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // 1) API：网络优先，失败回退缓存（离线也能看上次数据）
  if (isApi(url)) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  // 2) 同源静态资源：缓存优先，网络回源并刷新
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (r) {
        if (r) return r;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return caches.match('./index.html'); });
      })
    );
    return;
  }

  // 3) 其他外链（网速/出口 IP 测试等）：仅走网络，不缓存
});
