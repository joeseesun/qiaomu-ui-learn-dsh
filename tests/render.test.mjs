import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {LearnQuiz} from '../src/original-ui/learn-quiz.ts';
import {saveReview,cancelReviewTimers} from '../src/original-ui/learn-review.ts';
import {GalleryView} from '../src/original-ui/gallery-view.ts';
import {LearnEntryModal} from '../src/original-ui/learn-entry-modal.ts';
import {LearnStyleModal} from '../src/original-ui/learn-style-modal.ts';
import {DesignModal} from '../src/original-ui/design-modal.ts';
import {GallerySettingTab} from '../src/original-ui/settings.ts';
import {createLearningController} from '../src/native-app.jsx';
import {initI18n} from '../src/original-ui/i18n.ts';
import {enhance,disposeSurfaces} from '../src/harness-ui.ts';
import learn from '../data/learnui.json' with {type:'json'};
function environment(){const dom=new JSDOM('<!doctype html><body><main></main></body>',{url:'https://localhost',pretendToBeVisual:true});for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','MutationObserver','MouseEvent','KeyboardEvent','Element','Node','DocumentFragment'])globalThis[key]=key==='window'?dom.window:dom.window[key];globalThis.innerWidth=1400;globalThis.innerHeight=900;globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};return dom;}
test('original gallery, dictionary, styles, quiz, settings and 106 dialogs mount without Obsidian',async()=>{
 const dom=environment();let revision=0;const api={load:async()=>({revision:0,data:{}}),save:async({data})=>({revision:++revision,data})};const plugin=createLearningController(api,{revision:0,data:{}});
 try{
 for(const locale of ['zh','en']){initI18n(locale);const root=enhance(document.querySelector('main'));const view=new GalleryView({contentEl:root,app:plugin.app},plugin);await view.onOpen();assert.equal(root.querySelectorAll('.qpg-card').length,80);assert.ok(root.querySelector('.qpg-nav'));for(const mode of ['dictionary','styles','quiz','gallery'])view.setMode(mode);await view.onClose();root.empty();
 for(const entry of learn.entries){const dialog=new LearnEntryModal(plugin,entry);dialog.open();await Promise.resolve();assert.ok(document.querySelector('.qpg-learn-modal'));assert.match(dialog.contentEl.textContent,new RegExp(entry.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));dialog.close();}
 for(const style of learn.styles){const dialog=new LearnStyleModal(plugin,style);dialog.open();await Promise.resolve();assert.ok(dialog.contentEl.textContent.includes(style.name));dialog.close();}
 const design=new DesignModal(plugin.app,plugin,plugin.flatItems.slice(0,3),0);design.open();assert.ok(design.contentEl.querySelector('.qpg-lightbox-stage'));design.close();
 const settings=new GallerySettingTab(plugin.app,plugin);settings.containerEl=root;settings.display();assert.ok(root.querySelector('.qpg-set-hero'));assert.ok(root.querySelectorAll('.setting-item').length>=10);root.empty();
 }
 }finally{disposeSurfaces();dom.window.close();}
});
test('upstream product stylesheet is unchanged',async()=>{
 const css=await readFile(new URL('../src/original-ui/styles.css',import.meta.url));assert.equal(createHash('sha256').update(css).digest('hex'),'8e50e843e7ec3a9099265f19f61e12f939c45d77930d51d5fd9fd979d92260b7');
});

test('original review and quiz controllers preserve edits, mastery and choice semantics', async()=>{
 const dom=environment();dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 let revision=0;const writes=[];const api={save:async({data})=>{writes.push(data);return {revision:++revision,data};}};
 const plugin=createLearningController(api,{revision:0,data:{}});initI18n('zh');
 const quiz=new LearnQuiz(enhance(document.querySelector('main')),plugin);
 try{
  const item=quiz.current.item;
  assert.equal(new Set(quiz.current.choices.map(i=>i.key)).size,4);
  assert.ok(quiz.current.choices.every(i=>i.kind===item.kind));
  quiz.record(item.key,true);assert.equal(plugin.settings.quizState[item.key].m,0);
  quiz.record(item.key,true);assert.equal(plugin.settings.quizState[item.key].m,1);
  quiz.record(item.key,false);assert.equal(plugin.settings.quizState[item.key].m,0);assert.equal(plugin.settings.quizState[item.key].seen,3);
  quiz.recent=quiz.items().slice(0,4).map(i=>i.key);
  assert.ok(!quiz.recent.includes(quiz.pickNext().item.key));
  saveReview(plugin,'entry:tabs',{rating:5,note:'keep',tags:['test']});
  await plugin.dispose();assert.equal(writes.at(-1).learnReviews['entry:tabs'].note,'keep');
  saveReview(plugin,'entry:tabs',{rating:0,note:' ',tags:[]});assert.equal(plugin.settings.learnReviews['entry:tabs'],undefined);
  const another=createLearningController(api,{revision,data:{}});
  assert.deepEqual(another.settings.learnReviews,{});assert.deepEqual(another.settings.quizState,{});
 }finally{cancelReviewTimers(plugin);quiz.destroy();disposeSurfaces();dom.window.close();}
});

test('original style comparison opens the related style and all specimen frames are sandboxed',async()=>{
 const dom=environment();initI18n('zh');const plugin=createLearningController({save:async({data})=>({revision:1,data})},{revision:0,data:{}});
 try{const style=learn.styles.find(s=>s.confusedWith&&learn.styles.some(other=>other.slug===s.confusedWith.slug));const dialog=new LearnStyleModal(plugin,style);dialog.open();await Promise.resolve();const frame=document.querySelector('iframe');assert.equal(frame.getAttribute('sandbox'),'allow-scripts');document.querySelector('.qpg-confused-card').click();await Promise.resolve();const other=learn.styles.find(s=>s.slug===style.confusedWith.slug);assert.ok(document.querySelector('.qpg-learn-title').textContent.includes(other.name));}finally{disposeSurfaces();dom.window.close();}
});
