import test from 'node:test';
import assert from 'node:assert/strict';
import {createHomeProvider} from '../src/home-provider.js';
import {initI18n} from '../src/original-ui/i18n.ts';
import {copyText} from '../src/original-ui/learn-shared.ts';
import {JSDOM} from 'jsdom';
test('Home catalog search and recent designs route to original design dialogs',async()=>{
 initI18n('zh');const opened=[];let data={recents:[]};const p=createHomeProvider({load:async()=>({data}),open:action=>opened.push(action)});
 const results=p.search('a',3);assert.equal(results.length,3);assert.ok(results[0].title.toLowerCase().startsWith('a'));results[0].open();assert.deepEqual(opened[0],{kind:'design',key:results[0].id});
 data={recents:[results[0].id,'missing']};const sections=await p.sections();assert.equal(sections[0].items.length,1);assert.equal(sections[0].items[0].id,results[0].id);sections[0].more.run();assert.equal(opened.at(-1),'gallery');assert.equal(p.actions().length,1);
});
test('clipboard rejection never announces a successful copy',async()=>{
 const dom=new JSDOM('<body></body>',{url:'https://localhost'});globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.HTMLElement=dom.window.HTMLElement;
 const old=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:async()=>{throw Error('denied');}}},configurable:true});
 try{initI18n('zh');assert.equal(await copyText('value'),false);assert.match(document.body.textContent,/复制失败/);assert.doesNotMatch(document.body.textContent,/已复制/);}finally{if(old)Object.defineProperty(globalThis,'navigator',old);else delete globalThis.navigator;dom.window.close();}
});
