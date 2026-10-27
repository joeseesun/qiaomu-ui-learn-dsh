import { remoteApi } from "./remote.js";
import React, { useEffect, useState } from "react";
import { BookOpen, Palette, AudioLines, FileText } from "lucide-react";
import { NAME, ID, TITLE, EN_TITLE, SERVICE } from "./meta.js";
import {initI18n} from "./original-ui/i18n";
import {createHomeProvider} from "./home-provider.js";
import { App } from "./native-app.jsx";
import originalCss from "./original-ui/styles.css";
import hostCss from "./harness-ui.css";
const css = hostCss + "\n" + originalCss;
const ICON = NAME.includes("ui-learn")
  ? BookOpen
  : NAME.includes("cover")
    ? Palette
    : NAME.includes("audio")
      ? AudioLines
      : FileText;
export const inject = ["slots", "remote", "locale"];
export function apply(ctx) {

  let pending = null, runAction = null;
  const homeListeners=new Set();
  const actions = {
    changed(){for(const fn of homeListeners)fn();},
    attach(handler) { runAction=handler; if(pending){const next=pending;pending=null;void handler(next);} return()=>{if(runAction===handler)runAction=null;}; },
    send(action) { if(runAction)void runAction(action);else pending=action; },
  };
  ctx.inject(["shortcuts","layout"], ready => {
    for(const [action,zh,en] of [
      ["gallery","打开灵感图库","Open design gallery"],
      ["dictionary","打开 UI 词典","Open UI dictionary"],
      ["styles","打开风格图鉴","Open style atlas"],
      ["quiz","打开审美测验","Open design quiz"],
      ["export","导出全部学习笔记","Export all study notes"],
    ]) ready.effect(()=>ready.shortcuts.register({
      id:`${ID}.${action}`,label:()=>`${TITLE} · ${navigator.language.startsWith('zh')?zh:en}`,
      aliases:[en,zh,"Qiaomu UI Learn"],defaults:{},regions:["page","editable"],modals:[],
      resolve:()=>({status:"handled",run:()=>{ready.layout.selectPanel(ID);actions.send(action);}}),
    }));
  });
  const listeners = new Set();
  let api = null,
    error = "";
  const notify = () => {listeners.forEach((f) => f());actions.changed();};
  ctx.inject(["qiaomuHome","layout"],ready=>ready.effect(()=>ready.qiaomuHome.register(NAME,createHomeProvider({
    load:()=>api?.load()??Promise.resolve({data:{}}),
    open:action=>{ready.layout.selectPanel(ID);actions.send(action);},
    subscribe:fn=>{homeListeners.add(fn);return()=>homeListeners.delete(fn);},
  }),{label:TITLE})));
  let disposed = false;
  ctx.effect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.effect(() =>
    ctx.locale.register(ID, { zh: { title: TITLE, language:"zh" }, en: { title: EN_TITLE, language:"en" } }),
  );
  const hostLanguage=()=>ctx.locale.bind(ID)("language");
  initI18n(hostLanguage()==="zh"?"zh":"en");
  const codec = () => ({
    mode: "strict",
    typeSymbol: NAME + "#json",
    create: () => ({
      parse: (v) => v,
      safeParse: (v) => ({ success: true, data: v }),
    }),
  });
  const methods = [
    "load",
    "save",
    "notesList",
    "notesRead",
    "notesWrite",
    "referenceSource",
  ];
  const descriptors = methods.map((method) => ({
    id: `${NAME}#${SERVICE}/${method}`,
    service: SERVICE,
    namespace: SERVICE,
    method,
    invocation: { kind: "direct" },
    parameters: ["load", "voices"].includes(method)
      ? []
      : [{ name: "request", wire: "request", source: "json", codec: codec() }],
    result: { mode: "src-json" },
    cancellation: { parameter: "signal" },
  }));
  ctx.effect(() => () => {
    disposed = true;
    api = null;
    listeners.clear();
    homeListeners.clear();
  });
  ctx.remote
    .$mount({ package: NAME, descriptors })
    .then(() => {
      if (disposed) return;
      ctx.inject(["remote." + SERVICE], (ready) => {
        api = remoteApi(ready.remote[SERVICE], methods);
        error = "";
        notify();
        return () => {
          api = null;
          notify();
        };
      });
    })
    .catch((e) => {
      error = e.message;
      notify();
    });
  function Panel() {
    const [, render] = useState(0);
    useEffect(() => {
      const f = () => render((x) => x + 1);
      listeners.add(f);
      return () => listeners.delete(f);
    }, []);
    return (
      <div className="qpg-dsh-surface qpg-dsh-host" data-plugin={NAME}>
        {api ? (
          <App api={api} actions={actions} hostLanguage={hostLanguage()} />
        ) : (
          <p role="status">{error || "正在连接本地服务 / Connecting…"}</p>
        )}
      </div>
    );
  }
  ctx.effect(() =>
    ctx.slots.inject("main", () =>
      ctx.slots.register({ name: "main", key: ID, locale: ID }, Panel),
    ),
  );
  ctx.effect(() =>
    ctx.slots.inject("sidebar.panellist", () =>
      ctx.slots.register(
        {
          name: "sidebar.panellist",
          id: ID,
          order: 45,
          locale: ID,
          label: () => TITLE,
        },
        ICON,
      ),
    ),
  );
}
