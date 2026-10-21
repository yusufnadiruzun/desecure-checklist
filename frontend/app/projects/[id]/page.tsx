'use client';

import {use, useCallback, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {api} from '../../../lib/api';
import CompanyBrand from '../../components/CompanyBrand';

type Item = {id:number; title:string; section_title:string; section_order:number; parent_id:number|null; done:boolean; done_by:string|null; done_at:string|null};
type Data = {project:{name:string;code:string}; items:Item[]; show_completer:boolean};
type Filter = 'all'|'pending'|'done';

function formattedDate(value:string|null){
  if(!value)return '';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'':d.toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

export default function ProjectDetail({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<number|null>(null);
  const [filter,setFilter]=useState<Filter>('all');
  const [collapsed,setCollapsed]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);

  const refresh=useCallback(async()=>{
    try{setData(await api(`/projects/${id}`));setError('')}
    catch(err){setError((err as Error).message)}
    finally{setLoading(false)}
  },[id]);
  useEffect(()=>{void refresh()},[refresh]);

  async function mark(item:Item){
    if(busy!==null)return;
    setBusy(item.id);setError('');
    try{
      await api(`/projects/${id}/items/${item.id}`,{method:'PATCH',body:JSON.stringify({done:!item.done})});
      await refresh();
    }catch(err){setError((err as Error).message)}
    finally{setBusy(null)}
  }

  const items=useMemo(()=>data?.items||[],[data]);
  const doneCount=items.filter(x=>x.done).length;
  const percent=items.length?Math.round(doneCount/items.length*100):0;
  const sections=useMemo(()=>{
    const names=new Map<string,number>();
    for(const item of items)if(!names.has(item.section_title))names.set(item.section_title,item.section_order);
    return [...names.keys()].sort((a,b)=>(names.get(a)||0)-(names.get(b)||0));
  },[items]);
  const visible=(item:Item)=>filter==='all'||(filter==='done'?item.done:!item.done);

  return <main className="check-page">
    <div className="check-topbar no-print">
      <div className="check-topbar-left"><Link className="check-back" href="/" aria-label="Projeler sayfasına dön">←</Link><span><Link href="/">Projeler</Link><span className="check-breadcrumb"> / Proje checklist</span></span></div>
      <div className="check-topbar-company"><CompanyBrand compact/></div><button className="btn check-print-button" onClick={()=>window.print()} disabled={!data}><span aria-hidden>▤</span> Yazdır / PDF</button>
    </div>
    <div className="check-container">
      {error&&<div role="alert" className="alert error">{error}<button onClick={()=>setError('')} aria-label="Hatayı kapat">×</button></div>}
      {loading?<div className="check-loading">Checklist yükleniyor...</div>:!data?<div className="check-empty"><h2>Proje yüklenemedi</h2><p>Bağlantıyı kontrol edip tekrar deneyin.</p><button className="btn secondary" onClick={()=>void refresh()}>Tekrar dene</button></div>:<>
        <div className="paper-header"><div className="print-brand"><CompanyBrand/></div><h2>PROJE KONTROL FORMU</h2><p>{data.project.code} · {data.project.name}</p></div>
        <div className="compact-print-only">
          <table className="compact-print-table">
            <colgroup><col className="cp-no"/><col className="cp-section"/><col className="cp-criterion"/><col className="cp-status"/><col className="cp-person"/><col className="cp-sign"/></colgroup>
            <thead><tr><th>No</th><th>Kontrol Başlığı</th><th>Yapılacak İşlem / Kabul Kriteri</th><th>Durum</th><th>Yapan / Tarih</th><th>İmza</th></tr></thead>
            <tbody>{items.map((item,index)=><tr key={item.id}>
              <td>{index+1}</td><td>{item.section_title}</td><td className={item.parent_id?'cp-child':''}>{item.title}</td>
              <td>{item.done?'☑ Tamam':'☐ Bekliyor'}</td>
              <td>{item.done_by||'—'}{item.done_at&&<span className="cp-date">{formattedDate(item.done_at)}</span>}</td>
              <td className="cp-sign-line">&nbsp;</td>
            </tr>)}</tbody>
          </table>
        </div>
        <header className="check-hero">
          <div className="check-heading"><div className="check-kicker"><span className="check-kicker-dot"/> PROJE KONTROL LİSTESİ</div><h1>{data.project.name}</h1><div className="check-project-code"><span>Proje kodu</span><strong>{data.project.code}</strong></div></div>
          <div className="check-summary"><div className="check-progress-ring" style={{'--progress':`${percent}%`} as React.CSSProperties}><div><strong>{percent}%</strong><small>tamamlandı</small></div></div><div className="check-summary-stats"><strong>{doneCount} <span>/ {items.length}</span></strong><small>Toplam tamamlanan madde</small><div className="check-mini-track"><span style={{width:`${percent}%`}}/></div></div></div>
        </header>
        <div className="check-stats no-print"><div className="check-stat"><div className="check-stat-icon blue">☷</div><div><strong>{sections.length}</strong><span>Kontrol başlığı</span></div></div><div className="check-stat"><div className="check-stat-icon green">✓</div><div><strong>{doneCount}</strong><span>Tamamlanan</span></div></div><div className="check-stat"><div className="check-stat-icon amber">◷</div><div><strong>{items.length-doneCount}</strong><span>Bekleyen</span></div></div></div>
        <div className="check-list-heading no-print"><div><h2>Kontrol listesi</h2><p>Yapılan işlemleri işaretleyin; bilgiler otomatik kaydedilir.</p></div><div className="check-filters" aria-label="Madde filtresi"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Tümü</button><button className={filter==='pending'?'active':''} onClick={()=>setFilter('pending')}>Bekleyen</button><button className={filter==='done'?'active':''} onClick={()=>setFilter('done')}>Tamamlanan</button></div></div>
        {!sections.length?<div className="check-empty"><div className="check-empty-symbol">☷</div><h3>Henüz checklist maddesi yok</h3><p>Yönetici tarafından hazırlanan şablon yeni projelere uygulanır. Bu projede görüntülenecek madde bulunmuyor.</p></div>:<div className="check-section-list">
          {sections.map((section,index)=>{
            const sectionItems=items.filter(x=>x.section_title===section);
            const sectionDone=sectionItems.filter(x=>x.done).length;
            const isCollapsed=collapsed.includes(section);
            const shown=sectionItems.filter(visible);
            return <section className="check-section" key={section}>
              <div className="check-section-head"><span className="check-section-index">{String(index+1).padStart(2,'0')}</span><div className="check-section-title"><h2>{section}</h2><span>{sectionDone} / {sectionItems.length} tamamlandı</span></div><div className="check-section-progress no-print"><div><span style={{width:`${sectionItems.length?sectionDone/sectionItems.length*100:0}%`}}/></div></div><button className="check-collapse no-print" type="button" aria-expanded={!isCollapsed} aria-label={`${section} bölümünü ${isCollapsed?'aç':'daralt'}`} onClick={()=>setCollapsed(a=>isCollapsed?a.filter(x=>x!==section):[...a,section])}>{isCollapsed?'⌄':'⌃'}</button></div>
              <div className={`check-section-body ${isCollapsed?'check-section-collapsed':''}`}>
                {!shown.length?<div className="check-filter-empty no-print">Bu filtreye uygun madde bulunmuyor.</div>:sectionItems.map(item=><div className={`check-item ${!visible(item)?'check-item-filtered ':''}${item.done?'is-done':''} ${item.parent_id?'is-child':''}`} key={item.id}>
                  <label className="check-item-main"><input type="checkbox" disabled={busy!==null} checked={item.done} onChange={()=>void mark(item)} aria-label={`${item.title} — ${item.done?'tamamlandı':'bekliyor'}`}/><span className="check-box" aria-hidden>{item.done?'✓':''}</span><span className="check-item-title">{item.title}</span></label>
                  <div className="check-item-meta"><span className={`check-status ${item.done?'finished':'waiting'}`}><span className="check-status-dot"/>{item.done?'Tamamlandı':'Bekliyor'}</span>{item.done&&data.show_completer&&item.done_by&&<div className="check-person"><span className="check-person-avatar">{item.done_by.charAt(0).toLocaleUpperCase('tr-TR')}</span><span className="check-person-details"><strong>{item.done_by}</strong>{item.done_at&&<small>{formattedDate(item.done_at)}</small>}</span></div>}{item.done&&!data.show_completer&&<span className="check-hidden-person no-print">Personel gizli</span>}</div>
                  <div className="check-print-by">{item.done_by||'—'}{item.done_at&&<small>{formattedDate(item.done_at)}</small>}</div><div className="check-signature"/>
                </div>)}
              </div>
            </section>
          })}
        </div>}
        <footer className="check-footer no-print"><span>Son değişiklikleri görmek için sayfayı yenileyebilirsiniz.</span><button type="button" onClick={()=>void refresh()}>↻ Listeyi yenile</button></footer>
        <div className="check-print-footer"><div>Kontrol Eden / Ad Soyad</div><div>İmza / Tarih</div></div>
      </>}
    </div>
  </main>;
}
