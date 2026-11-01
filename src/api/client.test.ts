import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLibrary, watchEpisode } from './client';
beforeEach(()=>{
  vi.stubGlobal('window',{__FLOOPY_CONFIG__:{FLOPPY_URL:'https://floppy.example/prefix',FLOPPY_TOKEN:'test-only'}});
});
afterEach(()=>vi.unstubAllGlobals());
describe('verified API request contract',()=>{
  it('paginates locally without following server URLs or leaking bearer tokens',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({results:[],pagination:{offset:0,limit:100,total:101,next:'https://untrusted.example'}}))).mockResolvedValueOnce(new Response(JSON.stringify({results:[],pagination:{offset:100,limit:100,total:101,next:null}})));
    vi.stubGlobal('fetch',fetch);
    await getLibrary();
    expect(fetch.mock.calls.map(c=>c[0])).toEqual(['https://floppy.example/prefix/api/v1/media/tv/?limit=100&offset=0','https://floppy.example/prefix/api/v1/media/tv/?limit=100&offset=100']);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-only');
    expect(fetch.mock.calls[0][1].credentials).toBe('omit');
  });
  it('posts to the actual watch endpoint without inventing progress payloads',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response('{}',{status:201}));
    vi.stubGlobal('fetch',fetch);
    await watchEpisode('tmdb','12',2,3,'test-event');
    expect(fetch.mock.calls[0][0]).toBe('https://floppy.example/prefix/api/v1/media/tv/tmdb/12/2/episodes/3/watch/');
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({external_id:'test-event'});
  });
  it('reports token failures without exposing token or response body',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('secret server content',{status:403})));
    await expect(getLibrary()).rejects.toThrow('Floppy rejected the token');
  });
  it('converts network outages into a recoverable error',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(getLibrary()).rejects.toThrow('Cannot reach Floppy');
  });
});
