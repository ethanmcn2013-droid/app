import subprocess,pathlib,json,datetime,os,hashlib,sys,shutil
r=pathlib.Path(__file__).resolve().parent
node=shutil.which('node')
if not node:raise RuntimeError('Node is required')
attempt=sys.argv[1]
d=r/'attempts'/attempt
d.mkdir(parents=True,exist_ok=False)
env={k:v for k,v in os.environ.items() if k in ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','PATHEXT']}
env.update({'NODE_ENV':'production','VERCEL_ENV':'production','NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV':'production','SIGNAL_ACCESS_MODE':'production','NEXT_PUBLIC_SIGNAL_ACCESS_MODE':'production','GUEST_HARNESS_ROOT':str(r),'GUEST_APP_ROOT':str(r.parents[2]),'GUEST_ATTEMPT':attempt})
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (d/'stdout.jsonl').open('wb') as out,(d/'stderr.txt').open('wb') as err:
 try:
  p=subprocess.run([node,'--max-old-space-size=1024','--require',str(r/'network-blocker.cjs'),str(r/'rehearsal.bundle.mjs')],cwd=r,env=env,stdout=out,stderr=err,timeout=180)
  code=p.returncode;timeout=False
 except subprocess.TimeoutExpired:code=None;timeout=True
receipt={'startedAt':started,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'timedOut':timeout,'memoryLimitMiB':1024,'timeoutSeconds':180,'parallelProcesses':1,'source':'b805c5501f8198218791491ae0a2f26efbae0657','providerCredentialsInherited':False,'bundleSha256':hashlib.sha256((r/'rehearsal.bundle.mjs').read_bytes()).hexdigest(),'stdoutSha256':hashlib.sha256((d/'stdout.jsonl').read_bytes()).hexdigest(),'stderrSha256':hashlib.sha256((d/'stderr.txt').read_bytes()).hexdigest()}
(d/'process-receipt.json').write_text(json.dumps(receipt,indent=2))
cleanupRows=[]
for f in sorted((r/'databases').glob(attempt+'-*.db*')):
 if f.resolve().parent != (r/'databases').resolve():raise RuntimeError('Cleanup target outside owned DB root')
 b=f.read_bytes()
 entry={'path':str(f),'bytesBefore':len(b),'sha256Before':hashlib.sha256(b).hexdigest()}
 try:f.unlink();entry['absentAfter']=not f.exists()
 except Exception as error:entry['absentAfter']=False;entry['error']=str(error)
 cleanupRows.append(entry)
cleanup={'afterChildExited':True,'files':cleanupRows,'allAbsent':all(x['absentAfter'] for x in cleanupRows)}
(d/'postprocess-cleanup.json').write_text(json.dumps(cleanup,indent=2))
result=json.loads((d/'results.json').read_text()) if (d/'results.json').exists() else None
final={'source':receipt['source'],'attempt':attempt,'nativeExitCode':code,'allAssertionsPass':bool(result and result.get('allAssertionsPass')),'cleanup':cleanup,'allPass':code==0 and not timeout and bool(result and result.get('allAssertionsPass')) and cleanup['allAbsent'] and len(cleanupRows)==len(result['checks']) and result.get('networkAttempts')==[]}
(d/'receiving.json').write_text(json.dumps(final,indent=2))
print(json.dumps(receipt))
print(json.dumps({k:v for k,v in final.items() if k!='cleanup'}))
print((d/'stdout.jsonl').read_text(encoding='utf-8')[-4500:])
print((d/'stderr.txt').read_text(encoding='utf-8')[-2000:])
sys.exit(0 if final['allPass'] else 1)
