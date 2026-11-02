import { afterEach,describe,it,expect,vi } from 'vitest';
import { getConfig,serverCacheEnabled } from './runtime';
afterEach(()=>vi.unstubAllGlobals());
describe('renamed runtime config compatibility',()=>{
  it('uses the new server config without exposing upstream credentials',()=>{
    vi.stubGlobal('window',{__FLOPPY_GRID_CONFIG__:{SERVER_CACHE:true}});
    expect(serverCacheEnabled()).toBe(true);
    expect(getConfig()).toEqual({url:'',token:''});
  });
  it('supports the new development config name',()=>{
    vi.stubGlobal('window',{__FLOPPY_GRID_CONFIG__:{FLOPPY_URL:'http://floppy.example/',FLOPPY_TOKEN:'test-only'}});
    expect(getConfig()).toEqual({url:'http://floppy.example',token:'test-only'});
  });
  it('keeps older installed PWA shells compatible during rollout',()=>{
    vi.stubGlobal('window',{__FLOOPY_CONFIG__:{SERVER_CACHE:true}});
    expect(serverCacheEnabled()).toBe(true);
    expect(getConfig()).toEqual({url:'',token:''});
  });
  it('prefers the new config if both names exist',()=>{
    vi.stubGlobal('window',{__FLOPPY_GRID_CONFIG__:{FLOPPY_URL:'http://new.example',FLOPPY_TOKEN:'new-test'},__FLOOPY_CONFIG__:{SERVER_CACHE:true}});
    expect(serverCacheEnabled()).toBe(false);
    expect(getConfig().url).toBe('http://new.example');
  });
  it('does not require a browser window during rendering tests',()=>{
    vi.stubGlobal('window',undefined);
    expect(serverCacheEnabled()).toBe(false);
  });
});
