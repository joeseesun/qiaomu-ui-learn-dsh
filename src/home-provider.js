import catalog from '../data/catalog.json';
import {flatten,thumbUrl} from './original-ui/catalog';
import {t} from './original-ui/i18n';
const items=flatten(catalog),byKey=new Map(items.map(item=>[item.key,item]));
/** Original UI Learn Home provider; only the host navigation and state boundary differ. */
export function createHomeProvider({load,open,subscribe}) {
  const itemToHome=item=>({id:item.key,title:item.row[0],subtitle:item.cat.n,image:thumbUrl(item.row)??undefined,icon:'image',open:()=>open({kind:'design',key:item.key})});
  return {
    protocol:'qiaomu-home',version:1,subscribe,
    async sections(){const saved=await load();const recent=(saved?.data?.recents||[]).map(key=>byKey.get(key)).filter(Boolean).slice(0,6).map(itemToHome);return [{id:'recent-designs',title:t('home.recent.title'),items:recent,empty:t('home.recent.empty'),more:{id:'open-gallery',label:t('home.action.browse'),icon:'layout-grid',run:()=>open('gallery')}}];},
    actions(){return [{id:'browse-designs',label:t('home.action.browse'),icon:'layout-grid',run:()=>open('gallery')}];},
    search(query,limit){const q=query.trim().toLowerCase();if(!q)return [];return items.filter(item=>item.lowerName.includes(q)).sort((a,b)=>Number(!a.lowerName.startsWith(q))-Number(!b.lowerName.startsWith(q))).slice(0,limit).map(itemToHome);},
  };
}
