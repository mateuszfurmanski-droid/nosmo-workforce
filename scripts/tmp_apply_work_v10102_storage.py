from pathlib import Path


def replace(path, old, new, count=1):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    assert old in s, f'missing anchor in {path}: {old[:80]}'
    p.write_text(s.replace(old,new,count),encoding='utf-8')

# Canonical profile bridge: active Work namespace; legacy import is handled centrally.
p=Path('apps/work/js/canonical-work-profile-bridge.js')
s=p.read_text(encoding='utf-8')
s=s.replace('const LEGACY="nosmo-person-card-freeware:work-card/v2";','const LEGACY="nosmo-work:work-card/v2";')
s=s.replace('const MIGRATION="nosmo-person-card-freeware:canonical-work-profile-migrated/v1";','const MIGRATION="nosmo-work:migration:canonical-work-profile/v1";')
p.write_text(s,encoding='utf-8')

# Work Hub storage.
p=Path('apps/work/js/work-hub.js')
s=p.read_text(encoding='utf-8')
for old,new in {
    'nosmo-person-card-freeware:jobs/v1':'nosmo-work:jobs/v1',
    'nosmo-person-card-freeware:applications/v1':'nosmo-work:applications/v1',
    'nosmo-person-card-freeware:employers/v1':'nosmo-work:employers/v1',
    'nosmo-person-card-freeware:application-log/v1':'nosmo-work:application-log/v1',
    'nosmo-person-card-freeware:file-registry/v1':'nosmo-work:file-registry/v1',
}.items(): s=s.replace(old,new)
p.write_text(s,encoding='utf-8')

# Contact engine storage + file bytes DB.
p=Path('apps/work/js/contact-action-engine.js')
s=p.read_text(encoding='utf-8')
for old,new in {
    'nosmo-person-card-freeware:file-registry/v1':'nosmo-work:file-registry/v1',
    'nosmo-person-card-freeware:application-log/v1':'nosmo-work:application-log/v1',
    'nosmo-person-card-freeware:contact-draft/v1:':'nosmo-work:contact-draft/v1:',
    'nosmo-person-card-freeware-files-v1':'nosmo-work-files-v1',
}.items(): s=s.replace(old,new)
anchor='''  async function getStoredFile(id){\n    if(!id)return null;'''
assert anchor in s
s=s.replace(anchor,'''  async function getStoredFile(id){\n    if(!id)return null;\n    if(window.NOSMO_WORK_STORAGE_READY)await window.NOSMO_WORK_STORAGE_READY;''',1)
p.write_text(s,encoding='utf-8')

# Data/File Loader storage.
p=Path('apps/work/data-fetcher/app.js')
s=p.read_text(encoding='utf-8')
s=s.replace('nosmo-person-card-freeware:file-registry/v1','nosmo-work:file-registry/v1')
s=s.replace('nosmo-person-card-freeware-files-v1','nosmo-work-files-v1')
anchor='''  async function addSelected(){\n    if(!selected.length){message("Choose one or more files first.","warn");return;}'''
assert anchor in s
s=s.replace(anchor,'''  async function addSelected(){\n    if(!selected.length){message("Choose one or more files first.","warn");return;}\n    if(window.NOSMO_WORK_STORAGE_READY)await window.NOSMO_WORK_STORAGE_READY;''',1)
s=s.replace('schema:"nexus-person-card-data-fetcher-manifest/v2"','schema:"nosmo-work-data-fetcher-manifest/v1"')
s=s.replace('a.download="person-card-file-manifest.json"','a.download="nosmo-work-file-manifest.json"')
p.write_text(s,encoding='utf-8')

# Documents / Work Card active screen storage.
p=Path('apps/work/screen.html')
s=p.read_text(encoding='utf-8')
s=s.replace('nosmo-person-card-freeware:documents/v1','nosmo-work:documents/v1')
s=s.replace('nosmo-person-card-freeware:work-card/v2','nosmo-work:work-card/v2')
s=s.replace('nosmo-person-card-freeware:work-card/v1','nosmo-work:work-card/v1')
anchor='<script src="./js/canonical-work-profile-bridge.js?v=2"></script>'
assert anchor in s
s=s.replace(anchor,'<script src="./js/work-storage-migration.js?v=10102"></script>\n'+anchor,1)
p.write_text(s,encoding='utf-8')

# Worker Card loads migration before historical runtime can read storage.
p=Path('apps/work/index.html')
s=p.read_text(encoding='utf-8')
anchor='<script src="./js/person-onboarding-v47.js?v=freeware1"></script>'
assert anchor in s
s=s.replace(anchor,'<script src="./js/work-storage-migration.js?v=10102"></script>\n'+anchor,1)
p.write_text(s,encoding='utf-8')

# Data/File Loader loads same storage bridge from parent directory.
p=Path('apps/work/data-fetcher/index.html')
s=p.read_text(encoding='utf-8')
anchor='<script src="./app.js?v=freeware1"></script>'
assert anchor in s
s=s.replace(anchor,'<script src="../js/work-storage-migration.js?v=10102"></script>\n  '+anchor,1)
p.write_text(s,encoding='utf-8')

# Cache migration bridge with the PWA shell.
p=Path('apps/work/sw.js')
s=p.read_text(encoding='utf-8')
anchor="'./js/work-v10101-shell.js','./js/work-v1-runtime.js'"
assert anchor in s
s=s.replace(anchor,"'./js/work-v10101-shell.js','./js/work-storage-migration.js','./js/work-v1-runtime.js'",1)
p.write_text(s,encoding='utf-8')
