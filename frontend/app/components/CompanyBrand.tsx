'use client';
import {useState} from 'react';

// Place a complete company logo in frontend/public/images/desecure-logo.png.
// Override the URL with NEXT_PUBLIC_COMPANY_LOGO if the filename differs.
const logoPath=process.env.NEXT_PUBLIC_COMPANY_LOGO || '/images/desecure-logo.png';
export default function CompanyBrand({compact=false}:{compact?:boolean}){
  const [loadFailed,setLoadFailed]=useState(false);
  return <>
    <span className="company-logo-mark" aria-hidden="true">
      {!loadFailed?<img src={logoPath} alt="" onError={()=>setLoadFailed(true)}/>:<span className="company-logo-fallback">D</span>}
    </span>
    {!compact&&<span className="company-brand"><strong className="company-name">DESECURE TECHNOLOGY</strong><small className="company-subtitle">PROJE CHECKLIST SİSTEMİ</small></span>}
  </>;
}
