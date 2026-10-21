# DESECURE TECHNOLOGY — Render + Supabase (Docker yok)

Bu klasör mevcut V0.5 sürümünün birleştirilmiş, yayın ayarları eklenmiş halidir.

## 1. Supabase
- https://supabase.com/dashboard üzerinden ücretsiz bir proje oluştur.
- Project Settings → Database / Connect bölümünden **URI** biçimindeki PostgreSQL bağlantısını kopyala.
- SQLAlchemy için URL şemasını `postgresql+psycopg://` kullanacak şekilde ayarla.
- Host, port, kullanıcı, parola ve gerekli SSL parametrelerini Supabase'in verdiği bilgilerden al. Paroladaki özel karakterleri URI için encode et.
- **Bu parolayı GitHub'a veya sohbetlere yapıştırma.**

## 2. GitHub
- Bu klasörün içeriğini **özel (private)** bir GitHub deposuna yükle.
- `.env`, `.env.local`, `*.db`, `node_modules`, `.next` depoya eklenmemeli.

## 3. Render backend servisi
- New → Web Service → GitHub repository seç.
- Language/runtime: Python; root directory: `backend`; plan: Free.
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment değişkenleri:
  - `DATABASE_URL` = Supabase SQLAlchemy bağlantısı (gizli)
  - `SECRET_KEY` = uzun ve rastgele gizli anahtar (gizli)
  - `ADMIN_USERNAME` = admin (veya farklı tercih)
  - `ADMIN_PASSWORD` = güçlü, en az 12 karakter parola (gizli)
  - `COOKIE_SECURE` = true
  - `CORS_ORIGINS` = frontend adresi, örn. `https://desecure-checklist.onrender.com`
- Backend adresinde `/health` testi: `https://BACKEND.onrender.com/health`
- Uygulama ilk başlatıldığında tablolar ve ilk admin hesabı oluşturulur. Admin şifresinin sonradan env'de değiştirilmesi var olan hesabın şifresini değiştirmez.

## 4. Render frontend servisi
- New → Web Service → aynı GitHub deposu; runtime Node; root directory: `frontend`; plan: Free.
- Build command: `npm install && npm run build`
- Start command: `npm run start -- --port $PORT`
- Environment değişkenleri:
  - `NEXT_PUBLIC_API_URL` = `/api`
  - `API_PROXY_TARGET` = `https://BACKEND.onrender.com` (kendi backend adresin)
  - `NEXT_PUBLIC_COMPANY_LOGO` = `/images/desecure-logo.png`
- Frontend adresini `CORS_ORIGINS` değeri olarak backend'de ayarla ve yeniden yayınla.
- Sağlık testi: `https://FRONTEND.onrender.com/api/health`
- Frontend ve backend aynı adres altında `/api` reverse proxy üzerinden konuşur; giriş çerezleri buna göre tasarlanmıştır.

## 5. Kontrol listesi
1. `/api/health` -> `{"ok":true}`
2. İlk admin hesabıyla giriş.
3. Başlık ekle, proje ekle, madde işaretle.
4. Başka tarayıcıdan aynı projeyi aç; kayıtları doğrula.
5. Yönetici işlem geçmişini doğrula.
6. Çıktı al ve Türkçe karakterleri kontrol et.

## Önemli notlar
- Render Free servisleri boşta kalınca uyur; ilk açılış yavaş olabilir. Supabase Free projeleri düşük aktivitede duraklatılabilir. Saha operasyonunda garantili süreklilik beklenmemelidir.
- Veriler Render diskinde değil, Supabase PostgreSQL içinde tutulmalıdır; ücretsiz Render dosya sistemi kalıcı değildir.
- Eski SQLite kayıtlarını bu paket otomatik taşımaz. Daha önce veri girdiysen geçişten önce ayrı taşıma işlemi gerekir.
- V0.5'in mevcut log modeli temel işlem kayıtları tutar; istenen ayrıntılı log revizyonu henüz bu pakete eklenmedi.
- Gizli anahtarın ve veritabanı şifrenin saklandığı `.env` dosyalarını repoya gönderme.
