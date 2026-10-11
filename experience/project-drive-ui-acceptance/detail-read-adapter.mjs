export const detailReadFetchAdapter = `(() => {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === location.origin && url.pathname === '/api/tasks/detail-read') {
      const body = JSON.parse(init?.body ?? 'null');
      if (init?.method !== 'POST' || new Headers(init.headers).get('content-type') !== 'application/json' ||
          url.search || !body || Object.keys(body).sort().join(',') !== 'section,taskId' ||
          body.section !== 'resources' || body.taskId !== 'drive-task') throw Error('Detail read outside acceptance slice');
      const headers = {'Content-Type':'application/json','Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'};
      try { return new Response(JSON.stringify({value:await window.__drive.list(body.taskId)}), {headers}); }
      catch { return new Response(null, {status:500,headers}); }
    }
    return nativeFetch(input, init);
  };
})();`;
