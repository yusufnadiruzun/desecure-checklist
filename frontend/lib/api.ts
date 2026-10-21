const root=process.env.NEXT_PUBLIC_API_URL||'/api';
function csrf(){ return decodeURIComponent(document.cookie.split('; ').find(x=>x.startsWith('csrf_cookie='))?.split('=')[1]||''); }
export async function api(path:string,options:RequestInit={}){
  const method=(options.method||'GET').toUpperCase();
  const headers:Record<string,string>={'Content-Type':'application/json',...(options.headers as Record<string,string>||{})};
  if(!['GET','HEAD','OPTIONS'].includes(method))headers['X-CSRF-Token']=csrf();
  const res=await fetch(root+path,{...options,headers,credentials:'include',cache:'no-store'});
  if(!res.ok){let message='İşlem başarısız';try{const d=await res.json();message=d.detail||message;}catch{}if(res.status===401&&typeof window!=='undefined'&&!path.includes('/auth/login'))window.location.href='/login';throw new Error(message);}
  return res.json();
}
