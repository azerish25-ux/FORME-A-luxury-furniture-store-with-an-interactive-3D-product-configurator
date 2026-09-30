"""Create an UNREFERENCED review commit from a tested authoring workspace.

Never updates a branch, tag, PR or deployment. The caller must review artifacts
and explicitly fast-forward main afterward. GITHUB_TOKEN stays in the runner.
Only used by an explicitly authorized temporary authoring workflow.
"""
import base64
import hashlib
import json
import os
import pathlib
import subprocess
import urllib.request

root=pathlib.Path.cwd()
repo=os.environ['GITHUB_REPOSITORY']
parent=os.environ['GITHUB_SHA']
token=os.environ['GITHUB_TOKEN']
api='https://api.github.com/repos/'+repo

def call(path,data=None):
    req=urllib.request.Request(api+path,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)

head=call('/git/ref/heads/main')['object']['sha']
if head!=parent:raise SystemExit('main changed during authoring. Refusing a stale review candidate.')
parent_commit=call('/git/commits/'+parent)
base=call('/git/trees/'+parent_commit['tree']['sha']+'?recursive=1')
if base.get('truncated'):raise SystemExit('Refusing incomplete tree.')
known={e['path']:e['sha'] for e in base['tree'] if e['type']=='blob'}
# Only tracked files or non-ignored files are eligible. No caches, raw renders,
# test evidence, font installations, credentials or build-system downloads.
paths=subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z']).decode().split('\0')
changes=[]
for name in sorted(set(filter(None,paths))):
    path=root/name
    if name.startswith('tools/atelier-source.'):
        if name in known:changes.append({'path':name,'mode':'100644','type':'blob','sha':None})
        continue
    if not path.is_file():
        if name in known:changes.append({'path':name,'mode':'100644','type':'blob','sha':None})
        continue
    if name.startswith(('.git/','.env','node_modules/')):raise SystemExit('Unsafe candidate path '+name)
    content=path.read_bytes()
    digest=hashlib.sha1(b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest()
    if known.get(name)==digest:continue
    blob=call('/git/blobs',{'content':base64.b64encode(content).decode(),'encoding':'base64'})
    if blob['sha']!=digest:raise SystemExit('Blob identity mismatch '+name)
    changes.append({'path':name,'mode':'100644','type':'blob','sha':digest})
if not changes:raise SystemExit('No changes to review.')
tree=call('/git/trees',{'base_tree':parent_commit['tree']['sha'],'tree':changes})
commit=call('/git/commits',{'message':'feat: Atelier storefront, original furniture art and evidence-grounded design handoff','tree':tree['sha'],'parents':[parent]})
report={'commit':commit['sha'],'parent':parent,'tree':tree['sha'],'changedFiles':[e['path'] for e in changes],'branchUpdated':False,'reviewRequired':True}
(root/'evidence/review-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'candidate':commit['sha'],'changes':len(changes),'branchUpdated':False}))
with open(os.environ.get('GITHUB_STEP_SUMMARY','/dev/null'),'a') as f:f.write('\nReview candidate (no branch updated): `'+commit['sha']+'`\n')
