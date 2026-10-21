'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {api} from '../../lib/api';
import CompanyBrand from '../components/CompanyBrand';
export default function Login(){
  const [username,U]=useState('');const [password,P]=useState('');const [error,E]=useState('');const router=useRouter();
  async function submit(e:React.FormEvent){e.preventDefault();try{await api('/auth/login',{method:'POST',body:JSON.stringify({username,password})});router.replace('/')}catch(err){E((err as Error).message)}}
  return <main className="login-shell"><form className="surface stack login-card" onSubmit={submit}>
    <div className="login-brand"><CompanyBrand/></div><h1 className="login-heading">Hoş geldiniz</h1>
    <p className="muted">Proje checklist sistemine giriş yapın.</p>
    <input className="field" aria-label="Kullanıcı adı" autoComplete="username" placeholder="Kullanıcı adı" value={username} onChange={e=>U(e.target.value)} required/>
    <input className="field" aria-label="Şifre" autoComplete="current-password" type="password" placeholder="Şifre" value={password} onChange={e=>P(e.target.value)} required/>
    {error&&<p className="alert error" role="alert">{error}</p>}<button className="btn" type="submit">Giriş yap</button>
  </form></main>;
}
