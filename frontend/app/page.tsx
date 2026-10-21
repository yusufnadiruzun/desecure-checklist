'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {api} from '../lib/api';
import CompanyBrand from './components/CompanyBrand';

type Project={id:number;code:string;name:string;created_at:string};
type Item={id:number;title:string;parent_id:number|null};
type Section={id:number;title:string;items:Item[]};
type User={id:number;full_name:string;role:string};
type Dialog='project'|'user'|'section'|'item'|'deleteSection'|'editItem'|null;
type View='projects'|'template'|'settings';

export default function Home(){
  const [user,setUser]=useState<User|null>(null);
  const [projects,setProjects]=useState<Project[]>([]);
  const [sections,setSections]=useState<Section[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [dialog,setDialog]=useState<Dialog>(null);
  const [view,setView]=useState<View>('projects');
  const [query,setQuery]=useState('');
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [sectionTitle,setSectionTitle]=useState('');
  const [sectionToDelete,setSectionToDelete]=useState<Section|null>(null);
  const [itemSection,setItemSection]=useState<number|null>(null);
  const [itemTitle,setItemTitle]=useState('');
  const [parentId,setParentId]=useState('');
  const [editingItem,setEditingItem]=useState<Item|null>(null);
  const [showCompleter,setShowCompleter]=useState(true);
  const [newUser,setNewUser]=useState({username:'',full_name:'',password:''});
  const router=useRouter();

  const reload=useCallback(async()=>{
    try{
      const [me,p,s,settings]=await Promise.all([api('/auth/me'),api('/projects'),api('/template'),api('/settings')]);
      setUser(me);setProjects(p);setSections(s);setShowCompleter(settings.show_completer);setError('');
    }catch(err){const message=(err as Error).message;setError(message);if(message.includes('Oturum')||message.includes('401'))router.replace('/login')}
    finally{setLoading(false)}
  },[router]);
  useEffect(()=>{void reload()},[reload]);
  useEffect(()=>{if(!dialog)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)setDialog(null)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[dialog,busy]);

  async function action(fn:()=>Promise<unknown>,after?:()=>void){
    if(busy)return;
    setBusy(true);setError('');
    try{await fn();after?.();await reload()}
    catch(err){setError((err as Error).message)}
    finally{setBusy(false)}
  }
  const admin=user?.role==='admin';
  const filtered=projects.filter(p=>`${p.code} ${p.name}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')));
  const activeSection=sections.find(s=>s.id===itemSection);
  const close=()=>{setDialog(null);setError('')};
  const openDeleteSection=(section:Section)=>{setSectionToDelete(section);setDialog('deleteSection')};
  const openEditItem=(sectionId:number,item:Item)=>{setItemSection(sectionId);setEditingItem(item);setItemTitle(item.title);setParentId(item.parent_id?String(item.parent_id):'');setDialog('editItem')};
  const openItem=(sectionId:number)=>{setItemSection(sectionId);setItemTitle('');setParentId('');setDialog('item')};

  return <main className="app-frame">
    <aside className="sidebar no-print">
      <div className="brand"><CompanyBrand/></div>
      <div className="nav-label">ÇALIŞMA ALANI</div>
      <nav className="nav-links" aria-label="Ana menü">
        <button className={`nav-link ${view==='projects'?'selected':''}`} onClick={()=>setView('projects')}><span>▦</span> Projeler</button>
        {admin&&<><div className="nav-label nav-gap">YÖNETİM</div>
          <button className={`nav-link ${view==='template'?'selected':''}`} onClick={()=>setView('template')}><span>☷</span> Checklist şablonu</button>
          <button className={`nav-link ${view==='settings'?'selected':''}`} onClick={()=>setView('settings')}><span>⚙</span> Ayarlar</button></>}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile-avatar">{user?.full_name?.charAt(0)?.toLocaleUpperCase('tr-TR')||'?'}</div>
        <div className="profile-info"><strong>{user?.full_name||'Yükleniyor...'}</strong><small>{admin?'Yönetici':'Personel'}</small></div>
        <button className="icon-button logout" aria-label="Çıkış" title="Çıkış" onClick={()=>action(()=>api('/auth/logout',{method:'POST'}),()=>router.push('/login'))}>↪</button>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar no-print"><span>Çalışma alanı <span className="breadcrumb">/ {view==='projects'?'Projeler':view==='template'?'Checklist şablonu':'Ayarlar'}</span></span><span className="topbar-status"><i/> Sistem paneli</span></header>
      <div className="content-area">
        {error&&<div className="alert error" role="alert">{error}<button aria-label="Hatayı kapat" onClick={()=>setError('')}>×</button></div>}
        {view==='projects'&&<>
          <div className="page-heading"><div><p className="eyebrow">PROJE TAKİBİ</p><h1>Projeler</h1><p className="muted">Sahadaki işlerin kontrol listelerini tek yerden takip edin.</p></div>{admin&&<button className="btn" onClick={()=>{setName('');setCode('');setDialog('project')}}><span className="plus">+</span> Yeni proje</button>}</div>
          <div className="summary-grid"><div className="summary-tile"><span className="tile-icon">▦</span><div><strong>{projects.length}</strong><small>Aktif proje</small></div></div><div className="summary-tile"><span className="tile-icon">☷</span><div><strong>{sections.length}</strong><small>Checklist başlığı</small></div></div></div>
          <section className="surface"><div className="surface-heading"><div><h2>Proje listesi</h2><p className="muted small">Açmak için bir projeye tıklayın.</p></div><input className="field search" aria-label="Projelerde ara" placeholder="⌕  Proje ara..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
            {loading?<p className="muted loading-state">Projeler yükleniyor...</p>:filtered.length?<div className="project-list">{filtered.map(p=><Link className="project-entry" href={`/projects/${p.id}`} key={p.id}><span className="project-symbol">▤</span><span className="project-details"><strong>{p.name}</strong><small>{p.code}</small></span><span className="project-date">{new Date(p.created_at).toLocaleDateString('tr-TR')}</span><span className="entry-arrow">→</span></Link>)}</div>:<div className="empty-state"><div className="empty-icon">▤</div><h3>{query?'Aramanızla eşleşen proje yok':'Henüz proje oluşturulmadı'}</h3><p>{query?'Başka bir proje adı veya kodu deneyin.':'İlk projenizi oluşturduğunuzda burada listelenecek.'}</p>{admin&&!query&&<button className="btn secondary" onClick={()=>setDialog('project')}>+ İlk projeyi oluştur</button>}</div>}</section>
        </>}
        {view==='template'&&admin&&<>
          <div className="page-heading"><div><p className="eyebrow">YÖNETİM</p><h1>Checklist şablonu</h1><p className="muted">Başlıkları ve kontrol maddelerini tamamen siz belirleyin.</p></div><button className="btn" onClick={()=>{setSectionTitle('');setDialog('section')}}>+ Yeni başlık</button></div>
          <div className="hint"><strong>Nasıl çalışır?</strong> Yeni proje oluşturulduğunda buradaki şablon o projeye kopyalanır. Sonradan eklediğiniz maddeler mevcut projeleri değiştirmez.</div>
          {!sections.length?<section className="surface empty-state"><div className="empty-icon">☷</div><h3>Checklist henüz boş</h3><p>Herhangi bir örnek başlık veya madde eklenmedi. Başlıkları kendiniz oluşturabilirsiniz.</p><button className="btn secondary" onClick={()=>setDialog('section')}>+ İlk başlığı ekle</button></section>:<div className="section-stack">{sections.map((s,i)=><section className="surface template-section" key={s.id}><div className="section-heading"><div className="section-number">{String(i+1).padStart(2,'0')}</div><div className="section-name"><h2>{s.title}</h2><span className="muted small">{s.items.length} madde</span></div><div className="section-controls"><button className="btn ghost" disabled={busy} onClick={()=>openItem(s.id)}>+ Madde ekle</button><button type="button" className="btn section-delete-button" disabled={busy} onClick={()=>openDeleteSection(s)} aria-label={`${s.title} başlığını sil`} title="Başlığı sil">Sil</button></div></div><div className="section-body">{s.items.length?s.items.map(item=><div key={item.id} className={`template-row ${item.parent_id?'nested':''}`}><span className="bullet"/><span className="template-item-text">{item.title}</span><button type="button" className="template-edit-button" disabled={busy} onClick={()=>openEditItem(s.id,item)} aria-label={`${item.title} maddesini düzenle`}>✎ Düzenle</button></div>):<p className="muted small section-empty">Bu başlık altında henüz madde yok.</p>}</div></section>)}</div>}
        </>}
        {view==='settings'&&admin&&<>
          <div className="page-heading"><div><p className="eyebrow">YÖNETİM</p><h1>Ayarlar</h1><p className="muted">Kullanıcı ve görünürlük tercihlerini yönetin.</p></div><button className="btn" onClick={()=>{setNewUser({username:'',full_name:'',password:''});setDialog('user')}}>+ Kullanıcı ekle</button></div>
          <section className="surface settings-card"><div className="settings-icon">◎</div><div className="settings-copy"><h2>Personel görünürlüğü</h2><p className="muted">Açıkken personeller tamamlanan işlemi kimin yaptığını görebilir. Kapalıyken bu bilgi yalnızca yöneticilere gösterilir; kayıtlar silinmez.</p></div><label className="switch" aria-label="İşlemi yapan personeli göster"><input type="checkbox" checked={showCompleter} disabled={busy} onChange={e=>{const desired=e.target.checked;void action(()=>api('/settings',{method:'PATCH',body:JSON.stringify({show_completer:desired})}))}}/><span className="switch-track"/></label></section>
          <section className="surface settings-card"><div className="settings-icon">♙</div><div className="settings-copy"><h2>Kullanıcı yönetimi</h2><p className="muted">Yeni personel hesabı oluşturmak için sağdaki butonu kullanın. Kullanıcı bilgilerini sürekli açık formlarda tutmuyoruz.</p></div><button className="btn secondary" onClick={()=>setDialog('user')}>+ Kullanıcı ekle</button></section>
        </>}
      </div>
    </div>
    {dialog&&<div className="modal-backdrop no-print" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)close()}}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-head"><div><h2 id="dialog-title">{dialog==='project'?'Yeni proje oluştur':dialog==='user'?'Kullanıcı ekle':dialog==='section'?'Yeni checklist başlığı':dialog==='deleteSection'?'Başlığı sil':dialog==='editItem'?'Kontrol maddesini düzenle':'Kontrol maddesi ekle'}</h2><p className="muted small">{dialog==='project'?'Proje bilgilerini girin.':dialog==='user'?'Yeni personelin giriş bilgilerini belirleyin.':dialog==='section'?'Liste için bir başlık tanımlayın.':dialog==='deleteSection'?'Bu işlem için onayınız gerekiyor.':dialog==='editItem'?'Madde adını veya üst maddesini değiştirebilirsiniz.':'Seçilen başlığa yeni madde veya alt madde ekleyin.'}</p></div><button type="button" className="icon-button" aria-label="Kapat" onClick={close} disabled={busy}>×</button></div>
      {error&&<p role="alert" className="alert error">{error}</p>}
      {dialog==='project'&&<form className="dialog-form" onSubmit={e=>{e.preventDefault();void action(()=>api('/projects',{method:'POST',body:JSON.stringify({code,name})}),close)}}><label>Proje kodu<input autoFocus className="field" value={code} onChange={e=>setCode(e.target.value)} placeholder="Örn. PRJ-2026-001" required maxLength={80}/></label><label>Proje adı<input className="field" value={name} onChange={e=>setName(e.target.value)} placeholder="Proje adını girin" required minLength={2} maxLength={250}/></label><div className="dialog-footer"><button type="button" className="btn secondary" onClick={close}>Vazgeç</button><button className="btn" disabled={busy}>{busy?'Kaydediliyor...':'Projeyi oluştur'}</button></div></form>}
      {dialog==='user'&&<form className="dialog-form" onSubmit={e=>{e.preventDefault();void action(()=>api('/users',{method:'POST',body:JSON.stringify({...newUser,role:'staff'})}),close)}}><label>Ad soyad<input autoFocus className="field" value={newUser.full_name} onChange={e=>setNewUser(a=>({...a,full_name:e.target.value}))} placeholder="Ad soyad" required minLength={2}/></label><label>Kullanıcı adı<input className="field" value={newUser.username} onChange={e=>setNewUser(a=>({...a,username:e.target.value}))} placeholder="Giriş kullanıcı adı" required minLength={3}/></label><label>Şifre<input className="field" type="password" value={newUser.password} onChange={e=>setNewUser(a=>({...a,password:e.target.value}))} placeholder="En az 12 karakter" required minLength={12}/></label><div className="dialog-footer"><button type="button" className="btn secondary" onClick={close}>Vazgeç</button><button className="btn" disabled={busy}>{busy?'Kaydediliyor...':'Kullanıcı oluştur'}</button></div></form>}
      {dialog==='section'&&<form className="dialog-form" onSubmit={e=>{e.preventDefault();void action(()=>api('/template/sections',{method:'POST',body:JSON.stringify({title:sectionTitle})}),close)}}><label>Başlık adı<input autoFocus className="field" value={sectionTitle} onChange={e=>setSectionTitle(e.target.value)} placeholder="Başlık adını girin" required minLength={2}/></label><div className="dialog-footer"><button type="button" className="btn secondary" onClick={close}>Vazgeç</button><button className="btn" disabled={busy}>Başlık ekle</button></div></form>}
      {dialog==='deleteSection'&&sectionToDelete&&<div className="dialog-form"><div className="delete-section-warning"><strong>“{sectionToDelete.title}” başlığı silinecek.</strong><p>Bu başlığa bağlı {sectionToDelete.items.length} kontrol maddesi ve alt maddesi de şablondan kalıcı olarak silinir.</p><p>Daha önce oluşturulmuş projelerin checklist kayıtları etkilenmez. Yeni projelerde bu başlık bulunmaz.</p></div><div className="dialog-footer"><button type="button" className="btn secondary" disabled={busy} onClick={close}>Vazgeç</button><button type="button" className="btn danger-solid" disabled={busy} onClick={()=>void action(()=>api(`/template/sections/${sectionToDelete.id}`,{method:'DELETE'}),()=>{setSectionToDelete(null);close()})}>{busy?'Siliniyor...':'Evet, başlığı sil'}</button></div></div>}
      {dialog==='editItem'&&editingItem&&<form className="dialog-form" onSubmit={e=>{e.preventDefault();void action(()=>api(`/template/items/${editingItem.id}`,{method:'PATCH',body:JSON.stringify({title:itemTitle,parent_id:parentId?Number(parentId):null})}),close)}}><label>Kontrol maddesi<input autoFocus className="field" value={itemTitle} onChange={e=>setItemTitle(e.target.value)} required minLength={2} maxLength={500}/></label><label>Bağlı olduğu madde<select className="field" value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Ana madde olarak göster</option>{activeSection?.items.filter(i=>i.id!==editingItem.id).map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label><p className="muted small">Şablonda yapılan değişiklikler yeni projelerde geçerlidir; mevcut projelerin kayıtları korunur.</p><div className="dialog-footer"><button type="button" className="btn secondary" disabled={busy} onClick={close}>Vazgeç</button><button className="btn" disabled={busy}>{busy?'Kaydediliyor...':'Değişiklikleri kaydet'}</button></div></form>}
      {dialog==='item'&&<form className="dialog-form" onSubmit={e=>{e.preventDefault();void action(()=>api('/template/items',{method:'POST',body:JSON.stringify({section_id:itemSection,title:itemTitle,parent_id:parentId?Number(parentId):null})}),close)}}><label>Kontrol maddesi<input autoFocus className="field" value={itemTitle} onChange={e=>setItemTitle(e.target.value)} placeholder="Yapılacak işlemi yazın" required minLength={2}/></label><label>Bağlı olduğu madde<select className="field" value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Ana madde olarak ekle</option>{activeSection?.items.map(i=><option key={i.id} value={i.id}>Alt madde: {i.title}</option>)}</select></label><div className="dialog-footer"><button type="button" className="btn secondary" onClick={close}>Vazgeç</button><button className="btn" disabled={busy}>Madde ekle</button></div></form>}
    </div></div>}
  </main>;
}
