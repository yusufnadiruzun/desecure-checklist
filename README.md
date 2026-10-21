# Proje Checklist — V0.1

İlk çalışan demo: kullanıcı girişi, yönetici paneli, dinamik checklist şablonu, proje açma, kullanıcı bazlı tamamlama, işlem geçmişi, yazdırma ve tarayıcıdan PDF kaydetme.

## Ön koşullar
Python 3.11+ ve Node.js 20+ (önerilen 22 LTS). Docker gerekmiyor.

## 1. Backend (Windows PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```
`backend/.env` içindeki `ADMIN_PASSWORD` değerini **en az 12 karakter** olacak şekilde değiştirin, `SECRET_KEY` için uzun rastgele bir değer kullanın.

```powershell
uvicorn app.main:app --reload --port 8000
```
API: http://localhost:8000/docs

## 2. Frontend (ayrı PowerShell)
```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```
Tarayıcı: http://localhost:3000
Giriş: `.env` içinde tanımladığınız ADMIN_USERNAME / ADMIN_PASSWORD.

## Deploy notları
- **Tek domain üzerinde ters proxy ile barındırma önerilir.** İlk geliştirme sürümü oturum için HttpOnly cookie ve çift gönderimli CSRF cookie kullanır. Farklı platform domainleri arasında cookie kullanmak tarayıcı kurallarına takılabilir. Bu nedenle Render üzerinde ayrı domainlere deploy etmeden önce tek domain üzerinden `/api` yönlendirmesi eklenmelidir (veya API aynı site alt domaininde sunulmalıdır).
- PostgreSQL geçişi için `DATABASE_URL=postgresql+psycopg://USER:PASS@HOST:5432/DBNAME` kullanılabilir.
- SQLite yerel geliştirme içindir; Render'ın geçici dosya sistemi üzerine kalıcı veri yazmayın.
- Ücretsiz hosting askıya alma ve kaynak kısıtlamaları olabilir.
- Bu ilk sürümde silme/düzenleme, proje arşivleme, nitelikli PDF üretimi, güvenli şifre sıfırlama, çoklu tamamlayan kişi, sürüm/migrasyon sistemi henüz eklenmedi.
- Canlıya çıkmadan önce: HTTPS, gerçek domain, güvenli cookie ayarı, veritabanı migrasyonları, düzenli yedekleme, giriş hız sınırı, izleme ve güvenlik testleri eklenmeli.
