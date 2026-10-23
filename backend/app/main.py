import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Response, Cookie, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, create_engine, select, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, Session, sessionmaker

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./checklist.db')
SECRET_KEY = os.getenv('SECRET_KEY', 'local-development-only-change-this')
if os.getenv('RENDER') and SECRET_KEY == 'local-development-only-change-this':
    raise RuntimeError('SECRET_KEY must be configured in production')
origins = [x.strip() for x in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',') if x.strip()]
engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
password_hash = PasswordHash.recommended()

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__='users'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default='staff')
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Section(Base):
    __tablename__='sections'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(250))
    position: Mapped[int] = mapped_column(Integer, default=0)

class TemplateItem(Base):
    __tablename__='template_items'
    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey('sections.id'))
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey('template_items.id'), nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0)

class Project(Base):
    __tablename__='projects'
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(250))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

class ProjectItem(Base):
    __tablename__='project_items'
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'))
    section_title: Mapped[str] = mapped_column(String(250))
    section_order: Mapped[int] = mapped_column(Integer)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey('project_items.id'), nullable=True)
    title: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'), nullable=True)
    done_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    done_by: Mapped[Optional[User]] = relationship(foreign_keys=[done_by_id])

class ItemComment(Base):
    __tablename__ = 'item_comments'
    id: Mapped[int] = mapped_column(primary_key=True)
    project_item_id: Mapped[int] = mapped_column(ForeignKey('project_items.id'), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    author: Mapped[User] = relationship(foreign_keys=[author_id])

class Setting(Base):
    __tablename__='settings'
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(String(500))

class Audit(Base):
    __tablename__='audit_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    action: Mapped[str] = mapped_column(String(100))
    target: Mapped[str] = mapped_column(String(100))
    target_id: Mapped[int] = mapped_column(Integer)
    details: Mapped[str] = mapped_column(String(1000), default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

app=FastAPI(title='Proje Checklist API', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=['GET','POST','PATCH','DELETE'], allow_headers=['Content-Type','X-CSRF-Token'])
Base.metadata.create_all(engine)


def db_session():
    with SessionLocal() as db: yield db


def log(db: Session, actor: User, action: str, target: str, target_id: int, details=''):
    db.add(Audit(actor_id=actor.id, action=action, target=target, target_id=target_id, details=details))


def init_seed():
    with SessionLocal() as db:
        if not db.scalar(select(User.id).limit(1)):
            uname=os.getenv('ADMIN_USERNAME','admin')
            pwd=os.getenv('ADMIN_PASSWORD','')
            if len(pwd)<8:
                raise RuntimeError('Set ADMIN_PASSWORD in backend/.env to at least 8 characters before first run')
            db.add(User(username=uname, full_name='Sistem Yöneticisi', password_hash=password_hash.hash(pwd), role='admin'))
        if not db.get(Setting,'show_completer'):
            db.add(Setting(key='show_completer',value='true'))
        db.commit()

init_seed()

class Login(BaseModel):
    username: str
    password: str
class UserCreate(BaseModel):
    username: str = Field(min_length=3,max_length=80)
    full_name: str = Field(min_length=2,max_length=150)
    password: str = Field(min_length=8)
    role: str = 'staff'
class ProjectCreate(BaseModel):
    code: str = Field(min_length=1,max_length=80)
    name: str = Field(min_length=2,max_length=250)
class SectionCreate(BaseModel):
    title: str = Field(min_length=2,max_length=250)
class ItemCreate(BaseModel):
    section_id: int
    title: str = Field(min_length=2,max_length=500)
    parent_id: Optional[int] = None
class ItemUpdate(BaseModel):
    title: str = Field(min_length=2,max_length=500)
    parent_id: Optional[int] = None

class Mark(BaseModel):
    done: bool
class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=3000)

class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=3000)

class SettingsUpdate(BaseModel):
    show_completer: bool

def user_view(u: User): return {'id':u.id,'username':u.username,'full_name':u.full_name,'role':u.role,'active':u.active}

def current_user(access_token: Optional[str]=Cookie(default=None),db:Session=Depends(db_session)):
    try:
        payload=jwt.decode(access_token or '', SECRET_KEY, algorithms=['HS256'])
        user=db.get(User,int(payload['sub']))
        if user is None or not user.active: raise ValueError()
        return user
    except Exception: raise HTTPException(401,'Oturum geçersiz. Yeniden giriş yapın.')

def admin(user:User=Depends(current_user)):
    if user.role!='admin': raise HTTPException(403,'Yönetici yetkisi gerekli')
    return user

def require_csrf(csrf_header:Optional[str]=Header(default=None,alias='X-CSRF-Token'),csrf_cookie:Optional[str]=Cookie(default=None)):
    import hmac
    if not csrf_header or not csrf_cookie or not hmac.compare_digest(csrf_header,csrf_cookie):
        raise HTTPException(403,'CSRF kontrolü başarısız')

@app.get('/health')
def health(): return {'ok':True}

@app.post('/auth/login')
def login(data:Login,response:Response,db:Session=Depends(db_session)):
    user=db.scalar(select(User).where(User.username==data.username))
    if user is None or not user.active or not password_hash.verify(data.password,user.password_hash): raise HTTPException(401,'Kullanıcı adı veya şifre hatalı')
    import secrets
    now=datetime.now(timezone.utc)
    token=jwt.encode({'sub':str(user.id),'exp':now+timedelta(hours=12)},SECRET_KEY,algorithm='HS256')
    secure=os.getenv('COOKIE_SECURE','false').lower()=='true'
    response.set_cookie('access_token',token,httponly=True,secure=secure,samesite='lax',max_age=43200,path='/')
    csrf=secrets.token_urlsafe(24)
    response.set_cookie('csrf_cookie',csrf,httponly=False,secure=secure,samesite='lax',max_age=43200,path='/')
    return user_view(user)

@app.post('/auth/logout', dependencies=[Depends(require_csrf)])
def logout(response:Response):
    response.delete_cookie('access_token');response.delete_cookie('csrf_cookie');return {'ok':True}

@app.get('/auth/me')
def me(u:User=Depends(current_user)):return user_view(u)

@app.get('/users')
def users(db:Session=Depends(db_session),u:User=Depends(admin)):
    return [user_view(x) for x in db.scalars(select(User).order_by(User.id)).all()]

@app.post('/users',dependencies=[Depends(require_csrf)])
def create_user(data:UserCreate,db:Session=Depends(db_session),u:User=Depends(admin)):
    if data.role not in ('staff','admin'):raise HTTPException(400,'Geçersiz rol')
    if db.scalar(select(User).where(User.username==data.username)):raise HTTPException(409,'Kullanıcı adı kullanılıyor')
    v=User(username=data.username,full_name=data.full_name,role=data.role,password_hash=password_hash.hash(data.password))
    db.add(v);db.flush();log(db,u,'create','user',v.id);db.commit();return user_view(v)

class UserStatusUpdate(BaseModel):
    active: bool

@app.patch('/users/{user_id}/status', dependencies=[Depends(require_csrf)])
def change_user_status(user_id: int, data: UserStatusUpdate, db: Session = Depends(db_session), actor: User = Depends(admin)):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(404, 'Kullanıcı bulunamadı')
    if not data.active and target.id == actor.id:
        raise HTTPException(400, 'Kendi hesabınızı pasife alamazsınız')
    if not data.active and target.role == 'admin':
        active_admin_count = db.scalar(select(func.count()).select_from(User).where(User.role == 'admin', User.active.is_(True))) or 0
        if target.active and active_admin_count <= 1:
            raise HTTPException(400, 'Son aktif yönetici pasife alınamaz')
    old_status = target.active
    if old_status == data.active:
        return user_view(target)
    target.active = data.active
    log(db, actor, 'activate' if data.active else 'deactivate', 'user', target.id,
        f'username={target.username}; old_active={old_status}; new_active={data.active}')
    db.commit()
    db.refresh(target)
    return user_view(target)

@app.get('/settings')
def get_settings(db:Session=Depends(db_session),u:User=Depends(current_user)):
    return {'show_completer':db.get(Setting,'show_completer').value=='true'}

@app.patch('/settings',dependencies=[Depends(require_csrf)])
def update_settings(data:SettingsUpdate,db:Session=Depends(db_session),u:User=Depends(admin)):
    db.get(Setting,'show_completer').value=str(data.show_completer).lower()
    log(db,u,'change','settings',0,f'show_completer={data.show_completer}');db.commit()
    return {'show_completer':data.show_completer}

@app.get('/template')
def template(db:Session=Depends(db_session),u:User=Depends(current_user)):
    sections=db.scalars(select(Section).order_by(Section.position,Section.id)).all()
    items=db.scalars(select(TemplateItem).order_by(TemplateItem.position,TemplateItem.id)).all()
    return [{'id':s.id,'title':s.title,'items':[{'id':i.id,'title':i.title,'parent_id':i.parent_id} for i in items if i.section_id==s.id]} for s in sections]

@app.post('/template/sections',dependencies=[Depends(require_csrf)])
def add_section(data:SectionCreate,db:Session=Depends(db_session),u:User=Depends(admin)):
    s=Section(title=data.title,position=db.scalar(select(func.count()).select_from(Section)) or 0)
    db.add(s);db.flush();log(db,u,'create','section',s.id);db.commit();return {'id':s.id,'title':s.title}

@app.delete('/template/sections/{section_id}',dependencies=[Depends(require_csrf)])
def delete_section(section_id:int,db:Session=Depends(db_session),u:User=Depends(admin)):
    section=db.get(Section,section_id)
    if section is None:
        raise HTTPException(404,'Checklist başlığı bulunamadı')
    # PostgreSQL foreign keys require deleting child items BEFORE the parent section.
    # Flush each descendant level, since simply db.delete() does not guarantee SQL order.
    items=db.scalars(select(TemplateItem).where(TemplateItem.section_id==section_id)).all()
    remaining={item.id:item for item in items}
    title=section.title
    try:
        while remaining:
            parent_ids={item.parent_id for item in remaining.values() if item.parent_id is not None}
            leaves=[item for item in remaining.values() if item.id not in parent_ids]
            if not leaves:
                raise HTTPException(409,'Alt madde ilişkilerinde döngü tespit edildi; silme iptal edildi')
            for item in leaves:
                db.delete(item)
                del remaining[item.id]
            db.flush()  # enforce child-first DELETE statements before the next layer
        db.delete(section)
        db.flush()
        log(db,u,'delete','section',section_id,f'title={title}; deleted_items={len(items)}')
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {'ok':True,'deleted_section_id':section_id,'deleted_item_count':len(items)}

@app.post('/template/items',dependencies=[Depends(require_csrf)])
def add_item(data:ItemCreate,db:Session=Depends(db_session),u:User=Depends(admin)):
    if not db.get(Section,data.section_id):raise HTTPException(404,'Başlık bulunamadı')
    if data.parent_id:
        parent=db.get(TemplateItem,data.parent_id)
        if not parent or parent.section_id!=data.section_id:raise HTTPException(400,'Alt madde aynı başlık altında olmalı')
    item=TemplateItem(section_id=data.section_id,title=data.title,parent_id=data.parent_id,position=db.scalar(select(func.count()).select_from(TemplateItem).where(TemplateItem.section_id==data.section_id)) or 0)
    db.add(item);db.flush();log(db,u,'create','template_item',item.id);db.commit();return {'id':item.id,'title':item.title}

@app.patch('/template/items/{item_id}',dependencies=[Depends(require_csrf)])
def update_template_item(item_id:int,data:ItemUpdate,db:Session=Depends(db_session),u:User=Depends(admin)):
    item=db.get(TemplateItem,item_id)
    if item is None:
        raise HTTPException(404,'Kontrol maddesi bulunamadı')
    title=data.title.strip()
    if len(title)<2:
        raise HTTPException(422,'Madde adı en az 2 karakter olmalı')
    if data.parent_id is not None:
        if data.parent_id==item.id:
            raise HTTPException(400,'Bir madde kendi alt maddesi olamaz')
        parent=db.get(TemplateItem,data.parent_id)
        if not parent or parent.section_id!=item.section_id:
            raise HTTPException(400,'Üst madde aynı başlık altında olmalı')
        # Prevent cycles, including selecting any descendant of this item.
        ancestor=parent
        visited=set()
        while ancestor is not None:
            if ancestor.id==item.id or ancestor.id in visited:
                raise HTTPException(400,'Döngü oluşturan üst madde seçilemez')
            visited.add(ancestor.id)
            ancestor=db.get(TemplateItem,ancestor.parent_id) if ancestor.parent_id else None
    old_title,old_parent=item.title,item.parent_id
    item.title=title
    item.parent_id=data.parent_id
    log(db,u,'update','template_item',item.id,
        f'old_title={old_title}; new_title={title}; old_parent_id={old_parent}; new_parent_id={data.parent_id}')
    db.commit()
    return {'id':item.id,'title':item.title,'parent_id':item.parent_id}

@app.get('/projects')
def projects(db:Session=Depends(db_session),u:User=Depends(current_user)):
    return [{'id':p.id,'code':p.code,'name':p.name,'created_at':p.created_at.isoformat()} for p in db.scalars(select(Project).where(Project.archived==False).order_by(Project.id.desc())).all()]

@app.post('/projects',dependencies=[Depends(require_csrf)])
def create_project(data:ProjectCreate,db:Session=Depends(db_session),u:User=Depends(admin)):
    if db.scalar(select(Project).where(Project.code==data.code)):raise HTTPException(409,'Proje kodu kullanılıyor')
    p=Project(code=data.code,name=data.name);db.add(p);db.flush()
    template_items=db.scalars(select(TemplateItem).order_by(TemplateItem.position,TemplateItem.id)).all()
    sections={s.id:s for s in db.scalars(select(Section)).all()}
    mapping={}
    # parent references may appear after their parent if position values were edited; create all then link
    for t in template_items:
        s=sections[t.section_id]
        v=ProjectItem(project_id=p.id,section_title=s.title,section_order=s.position,title=t.title,position=t.position)
        db.add(v);db.flush();mapping[t.id]=v
    for t in template_items:
        if t.parent_id: mapping[t.id].parent_id=mapping[t.parent_id].id
    log(db,u,'create','project',p.id);db.commit()
    return {'id':p.id,'code':p.code,'name':p.name}

@app.get('/projects/{project_id}')
def project_detail(project_id:int,db:Session=Depends(db_session),u:User=Depends(current_user)):
    p=db.get(Project,project_id)
    if not p or p.archived:raise HTTPException(404,'Proje bulunamadı')
    items=db.scalars(select(ProjectItem).where(ProjectItem.project_id==project_id).order_by(ProjectItem.section_order,ProjectItem.position,ProjectItem.id)).all()
    show=db.get(Setting,'show_completer').value=='true' or u.role=='admin'
    return {'project':{'id':p.id,'code':p.code,'name':p.name},'show_completer':show,'items':[{'id':v.id,'title':v.title,'section_title':v.section_title,'section_order':v.section_order,'parent_id':v.parent_id,'done':v.done,'done_by_id':v.done_by_id if (show or u.id == v.done_by_id) else None,'can_unmark':bool(v.done and (u.role=='admin' or v.done_by_id==u.id)),'done_by':v.done_by.full_name if v.done_by and show else None,'done_at':v.done_at.isoformat() if v.done_at else None} for v in items]}

@app.patch('/projects/{project_id}/items/{item_id}',dependencies=[Depends(require_csrf)])
def mark_item(project_id:int,item_id:int,data:Mark,db:Session=Depends(db_session),u:User=Depends(current_user)):
    item=db.scalar(select(ProjectItem).where(ProjectItem.id==item_id,ProjectItem.project_id==project_id).with_for_update())
    if not item:raise HTTPException(404,'Madde bulunamadı')
    if item.done==data.done:return {'ok':True}
    if item.done and not data.done and u.role!='admin' and item.done_by_id!=u.id:
        raise HTTPException(403,'Bu işareti yalnızca tamamlayan kullanıcı veya yönetici kaldırabilir.')
    previous_person=item.done_by_id
    item.done=data.done
    item.done_by_id=u.id if data.done else None
    item.done_at=datetime.now(timezone.utc) if data.done else None
    log(db,u,'mark_done' if data.done else 'unmark','project_item',item.id,
        f'project_id={project_id}; item={item.title[:320]}; old_done={not data.done}; new_done={data.done}; previous_done_by_id={previous_person}')
    db.commit()
    return {'ok':True}


def resolve_project_item(db:Session, project_id:int, item_id:int):
    item=db.get(ProjectItem,item_id)
    if item is None or item.project_id!=project_id:
        raise HTTPException(404,'Proje maddesi bulunamadı')
    return item


@app.get('/projects/{project_id}/items/{item_id}/comments')
def list_comments(project_id:int,item_id:int,db:Session=Depends(db_session),u:User=Depends(current_user)):
    resolve_project_item(db,project_id,item_id)
    comments=db.scalars(select(ItemComment).where(ItemComment.project_item_id==item_id,ItemComment.deleted_at.is_(None)).order_by(ItemComment.created_at,ItemComment.id)).all()
    return [{'id':c.id,'body':c.body,'author':c.author.full_name,'author_id':c.author_id,'created_at':c.created_at.isoformat(),
             'updated_at':c.updated_at.isoformat() if c.updated_at else None,'can_edit':c.author_id==u.id,'can_delete':c.author_id==u.id} for c in comments]


@app.post('/projects/{project_id}/items/{item_id}/comments',dependencies=[Depends(require_csrf)],status_code=201)
def add_comment(project_id:int,item_id:int,data:CommentCreate,db:Session=Depends(db_session),u:User=Depends(current_user)):
    resolve_project_item(db,project_id,item_id)
    body=data.body.strip()
    if not body:raise HTTPException(422,'Yorum boş olamaz')
    comment=ItemComment(project_item_id=item_id,author_id=u.id,body=body)
    db.add(comment);db.flush()
    log(db,u,'comment_create','item_comment',comment.id,f'project_id={project_id}; item_id={item_id}; body={body[:650]}')
    db.commit()
    return {'id':comment.id}


@app.patch('/projects/{project_id}/items/{item_id}/comments/{comment_id}',dependencies=[Depends(require_csrf)])
def edit_comment(project_id:int,item_id:int,comment_id:int,data:CommentUpdate,db:Session=Depends(db_session),u:User=Depends(current_user)):
    resolve_project_item(db,project_id,item_id)
    comment=db.get(ItemComment,comment_id)
    if comment is None or comment.project_item_id!=item_id or comment.deleted_at is not None:raise HTTPException(404,'Yorum bulunamadı')
    if comment.author_id!=u.id:raise HTTPException(403,'Yalnızca kendi yorumunu düzenleyebilirsin')
    body=data.body.strip()
    if not body:raise HTTPException(422,'Yorum boş olamaz')
    old=comment.body
    comment.body=body;comment.updated_at=datetime.now(timezone.utc)
    log(db,u,'comment_update','item_comment',comment.id,f'project_id={project_id}; item_id={item_id}; old={old[:360]}; new={body[:360]}')
    db.commit()
    return {'ok':True}


@app.delete('/projects/{project_id}/items/{item_id}/comments/{comment_id}',dependencies=[Depends(require_csrf)])
def delete_comment(project_id:int,item_id:int,comment_id:int,db:Session=Depends(db_session),u:User=Depends(current_user)):
    resolve_project_item(db,project_id,item_id)
    comment=db.get(ItemComment,comment_id)
    if comment is None or comment.project_item_id!=item_id or comment.deleted_at is not None:raise HTTPException(404,'Yorum bulunamadı')
    if comment.author_id!=u.id:raise HTTPException(403,'Yalnızca kendi yorumunu silebilirsin')
    comment.deleted_at=datetime.now(timezone.utc)
    log(db,u,'comment_delete','item_comment',comment.id,f'project_id={project_id}; item_id={item_id}; deleted_body={comment.body[:650]}')
    db.commit()
    return {'ok':True}

@app.get('/projects/{project_id}/history')
def project_history(project_id:int,db:Session=Depends(db_session),u:User=Depends(admin)):
    if not db.get(Project,project_id):raise HTTPException(404,'Proje bulunamadı')
    ids=select(ProjectItem.id).where(ProjectItem.project_id==project_id)
    comment_ids=select(ItemComment.id).where(ItemComment.project_item_id.in_(ids))
    from sqlalchemy import or_, and_
    events=db.execute(select(Audit,User.full_name).join(User,Audit.actor_id==User.id).where(or_(
        and_(Audit.target=='project_item',Audit.target_id.in_(ids)),
        and_(Audit.target=='item_comment',Audit.target_id.in_(comment_ids))
    )).order_by(Audit.id.desc())).all()
    return [{'id':a.id,'action':a.action,'target':a.target,'target_id':a.target_id,
             'actor':name,'at':a.created_at.isoformat(),'details':a.details} for a,name in events]
