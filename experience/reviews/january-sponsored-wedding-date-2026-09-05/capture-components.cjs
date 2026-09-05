const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('@playwright/test');
const app=process.cwd(),out=path.resolve(process.argv[2]),origin='http://127.0.0.1:4490';
fs.mkdirSync(out,{recursive:true});
const receipt={origin,source:app,sourceHead:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode:'actual Tasks entry/welcome/overview/form; fixture identity and board body; actual date action body and real local transaction',viewports:[],captures:[],consoleErrors:[],pageErrors:[],badResponses:[],externalRequests:[]};
let browser;
async function main(){
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1440,height:1080},{width:390,height:844}]){
  const label=viewport.width===390?'mobile':'desktop'; const year=label==='mobile'?2050:2030; const faultYear=year+10; receipt.viewports.push(viewport);
  const context=await browser.newContext({viewport,locale:'en-GB',timezoneId:'Europe/Dublin',colorScheme:'light',reducedMotion:'reduce'});
  await context.addCookies(['tasks_active_ws','signal_active_project'].map(name=>({name,value:'wedding-date-missing',url:origin})));
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(url.hostname)&&!['data:','blob:'].includes(url.protocol)){receipt.externalRequests.push(url.origin);return route.abort();}return route.continue();});
  const page=await context.newPage();
  page.on('console',message=>{if(message.type()==='error')receipt.consoleErrors.push(message.text());});
  page.on('pageerror',error=>receipt.pageErrors.push(String(error)));
  page.on('response',response=>{if(response.status()>=400)receipt.badResponses.push({url:response.url(),status:response.status()});});
  async function visit(state){const response=await page.goto(origin+'/app/project?workspaceId=wedding-date-'+state,{waitUntil:'domcontentloaded',timeout:120000});assert.equal(response.status(),200);await page.getByRole('heading',{name:state==='ordinary'?'Synthetic launch project':'Wedding date',exact:true}).waitFor({timeout:60000});}
  async function shot(name,form=true){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,`${name}-${label}.png`),fullPage:true});if(form)await page.locator('#wedding-date').screenshot({path:path.join(out,`${name}-${label}-form.png`)});fs.writeFileSync(path.join(out,`${name}-${label}.txt`),await page.locator('body').innerText());const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'document horizontal overflow');const fonts=await page.evaluate(()=>({family:getComputedStyle(document.body).fontFamily,geist:document.fonts.check("14px Geist")}));receipt.captures.push({name,label,url:page.url(),form,fonts});}
  await visit('missing');
  assert.equal(await page.locator('input[type=date]').inputValue(),'');
  assert.equal(await page.getByText('Set target date',{exact:true}).count(),0);
  await shot('missing');
  await page.locator('input[type=date]').fill(year+'-06-01');await page.getByRole('button',{name:'Save wedding date',exact:true}).click();
  await page.getByText('Your sponsored access is available until 30 August '+year+'.',{exact:true}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('input[type=date]').inputValue(),year+'-06-01');await shot('saved-later');
  await page.locator('input[type=date]').fill('2028-02-29');await page.getByRole('button',{name:'Save wedding date',exact:true}).click();
  await page.getByText('Wedding date saved.',{exact:true}).waitFor();await shot('saved-earlier');
  assert.equal(await page.getByText('Your sponsored access is available until 30 August '+year+'.',{exact:true}).count(),1);
  await page.getByRole('button',{name:'Clear date',exact:true}).click();await page.getByRole('button',{name:'Save wedding date',exact:true}).click();
  await page.getByText('Wedding date cleared. Access already granted is unchanged.',{exact:true}).waitFor();await shot('cleared');
  const beforeFault=await(await page.request.get(origin+'/fixture/state?projectId=wedding-date-missing')).json();
  await page.request.post(origin+'/fixture/fault?mode=block');
  await page.locator('input[type=date]').fill(faultYear+'-06-01');await page.getByRole('button',{name:'Save wedding date',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'We could not confirm your date was saved.'}).waitFor();
  assert.equal(await page.locator('input[type=date]').inputValue(),faultYear+'-06-01');
  const afterFault=await(await page.request.get(origin+'/fixture/state?projectId=wedding-date-missing')).json();
  assert.deepEqual(afterFault,beforeFault);await shot('failure-retains-grant-and-draft');
  await page.request.post(origin+'/fixture/fault?mode=clear');await page.getByRole('button',{name:'Save wedding date',exact:true}).click();
  await page.getByText('Your sponsored access is available until 30 August '+faultYear+'.',{exact:true}).waitFor();await shot('retry-repaired');
  await page.getByRole('button',{name:'Clear date',exact:true}).click();await page.getByRole('button',{name:'Save wedding date',exact:true}).click();await page.getByText('Wedding date cleared. Access already granted is unchanged.',{exact:true}).waitFor();
  await visit('expired');await shot('expired');
  await visit('revoked');await shot('revoked');
  await page.locator('input[type=date]').fill('2031-06-01');await page.getByRole('button',{name:'Save wedding date',exact:true}).click();
  await page.getByText('Wedding date saved.',{exact:true}).waitFor();assert.equal(await page.getByText('Your sponsored access was revoked. Changing the wedding date will not restore it.',{exact:true}).count(),1);await shot('revoked-date-saved');
  await visit('member');assert.equal(await page.getByRole('button',{name:'Save wedding date',exact:true}).count(),0);await shot('member');
  await visit('ordinary');assert.equal(await page.locator('#wedding-date').count(),0);await shot('ordinary',false);
  await page.goto(origin+'/app/tasks?workspaceId=wedding-date-missing&welcome=venue',{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByRole('link',{name:'Add or update your wedding date',exact:true}).waitFor({timeout:60000});
  assert.match(await page.getByRole('link',{name:'Add or update your wedding date',exact:true}).getAttribute('href'),/workspaceId=wedding-date-missing#wedding-date$/);
  await shot('arrival',false);
  await page.getByRole('button',{name:'Dismiss',exact:true}).click();
  await page.getByRole('link',{name:'Add your wedding date',exact:true}).waitFor();await shot('dismissed-still-discoverable',false);
  await page.getByRole('link',{name:'Add your wedding date',exact:true}).click();await page.getByRole('heading',{name:'Wedding date',exact:true}).waitFor();assert.ok(page.url().endsWith('workspaceId=wedding-date-missing#wedding-date'));
  await page.evaluate(()=>localStorage.clear());
  await page.goto(origin+'/app/tasks?workspaceId=wedding-date-member&welcome=venue',{waitUntil:'domcontentloaded'});
  await page.getByRole('link',{name:'View wedding date',exact:true}).first().waitFor();
  assert.equal(await page.getByRole('link',{name:'View wedding date',exact:true}).count(),2);
  assert.equal(await page.getByRole('link',{name:/Add your wedding date|Add or update your wedding date|View or update wedding date/}).count(),0);
  await shot('member-arrival-view-only',false);
  await page.getByRole('button',{name:'Dismiss',exact:true}).click();assert.equal(await page.getByRole('link',{name:'View wedding date',exact:true}).count(),1);await shot('member-dismissed-view-only',false);
  await page.getByRole('link',{name:'View wedding date',exact:true}).click();await page.getByText('Someone who can manage this project can update its wedding date.',{exact:true}).waitFor();await shot('member-entry-to-read-only-form');
  await context.close();
 }
 assert.deepEqual(receipt.externalRequests,[]);assert.deepEqual(receipt.pageErrors,[]);assert.deepEqual(receipt.badResponses,[]);assert.deepEqual(receipt.consoleErrors,[]);
}
main().then(()=>{receipt.ok=true;console.log(JSON.stringify({captures:receipt.captures.length,ok:true}));}).catch(error=>{receipt.ok=false;receipt.failure=String(error);console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));await browser?.close();});
