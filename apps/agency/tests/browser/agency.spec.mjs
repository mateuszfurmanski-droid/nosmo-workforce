import {test,expect} from '@playwright/test';

const agency={agencyId:'qa-agency',name:'Northline Construction Recruitment (DEMO)',role:'OWNER',verificationStatus:'DEMO',location:'Leeds'};
const request={requestId:'req-joiner-leeds',role:'Joiner',clientName:'Leeds Commercial Interiors',location:'Leeds',status:'OPEN',headcount:2,details:{requiredSkills:['Second fix','Fire door installation'],requiredLicences:['CSCS Blue'],startDate:'2026-09-07'}};

async function mockAgencyApi(page,capture={}){
  await page.route('**/api/**',async(route)=>{
    const req=route.request();const url=new URL(req.url());const path=url.pathname;const method=req.method();
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/api/auth/user')return json({user:{id:'qa-user',email:'recruiter@example.invalid',firstName:'Jordan',lastName:'Blake'}});
    if(path==='/api/person-card/agency/account')return json({agency});
    if(path==='/api/person-card/agency/v1/dashboard')return json({agency,summary:{rosterWorkers:2,consentedWorkers:1,openRequests:1,candidatesInPipeline:2,readinessAttention:1,livePlacements:0},pipeline:[{stage:'NEW',count:1},{stage:'SHORTLISTED',count:1}]});
    if(path==='/api/person-card/agency/v1/roster'&&method==='GET')return json({workers:[
      {rosterWorkerId:'r1',displayName:'Alex Turner',trade:'Joiner',location:'Leeds',availabilityStatus:'Available',skills:['Second fix','Fire door installation'],licences:['CSCS Blue'],workerAppConfirmed:false,connectionStatus:'IMPORTED'},
      {rosterWorkerId:'r2',displayName:'Noah Ward',trade:'Joiner',location:'Leeds',availabilityStatus:'Available',skills:['Second fix'],licences:[],workerAppConfirmed:false,connectionStatus:'IMPORTED'}
    ]});
    if(path==='/api/person-card/agency/candidates')return json({candidates:[{personId:'p1',displayName:'Chloe Martin',primaryTrade:'Joiner',locations:['Leeds'],availability:{label:'Available'},preferences:{targetRoles:['Joiner'],rate:{display:'£22/h'}},readiness:{cv:'ready',certificates:'ready',references:'ready'},pipeline:{stage:'NEW'}}]});
    if(path==='/api/person-card/agency/v1/requests'&&method==='GET')return json({requests:[request]});
    if(path==='/api/person-card/agency/activity')return json({activity:[{actionId:'a1',personId:'p1',displayName:'Chloe Martin',actionType:'CONTACTED',createdAt:'2026-09-05T07:00:00Z'}]});
    if(path==='/api/person-card/agency/profile')return json({agency,recruiter:{displayName:'Jordan Blake',jobTitle:'Senior Construction Recruiter',email:'recruiter@example.invalid',phone:'',bio:''}});
    if(path===`/api/person-card/agency/v1/requests/${request.requestId}/applications`)return json({applications:[{applicationId:'app1',rosterWorkerId:'r1',displayName:'Alex Turner',stage:'SHORTLISTED',readinessStatus:'READY',matchStrength:'STRONG',matchReasons:['Trade/role aligns with Joiner','Required licences are recorded'],matchGaps:[]}]});
    if(path==='/api/person-card/agency/v1/ask-nexus/query'&&method==='POST'){capture.nexus=(capture.nexus||0)+1;return json({answerType:'AVAILABLE_WORKERS',answer:'2 workers are ready for Leeds.',tenantScoped:true,evidence:[{displayName:'Alex Turner',trade:'Joiner',location:'Leeds'}]})}
    if(path==='/api/person-card/agency/v1/roster/import'&&method==='POST'){capture.importBody=JSON.parse(req.postData()||'{}');return json({created:capture.importBody.records?.length||0,updated:0,skipped:0,tenantScoped:true})}
    if(path==='/api/person-card/agency/v1/invites'&&method==='POST'){capture.inviteBody=JSON.parse(req.postData()||'{}');return json({schema:'nexus-person-onboarding-invite-created/v1',inviteId:'agency-invite-qa',expiresAt:'2026-09-12T12:00:00.000Z',onboardingUrl:'https://work.example.invalid/onboarding?inviteToken=signed.qa&inviteId=agency-invite-qa',invitePersisted:true,tenantScoped:true,consentGranted:false,recruiterSafeAccessGranted:false,privateWorkerFieldsIncluded:false},201)}
    if(path===`/api/person-card/agency/v1/requests/${request.requestId}/match`&&method==='POST'){capture.match=(capture.match||0)+1;return json({requestId:request.requestId,candidateCount:3,created:3,updated:0,explainable:true,algorithm:'deterministic-v1',tenantScoped:true})}
    if(path.startsWith('/api/person-card/agency/v1/applications/')&&method==='PATCH')return json({applicationId:'app1',stage:'CONTACTED',readinessStatus:'READY'});
    return json({error:`UNMOCKED_${method}_${path}`},404);
  });
}

test('critical Agency shell interactions are live and responsive',async({page})=>{
  const capture={};const failures=[];
  page.on('pageerror',(error)=>failures.push(error.message));
  page.on('console',(msg)=>{if(msg.type()==='error')failures.push(msg.text())});
  await mockAgencyApi(page,capture);
  await page.goto('/');
  await expect(page.locator('#appShell')).toBeVisible();
  await expect(page.locator('#dashboardAgencyName')).toContainText('Northline');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.locator('#nexusLogo').click();
  await expect(page.locator('#view-nexus')).toHaveClass(/active/);
  await page.getByRole('button',{name:'Ready for Leeds'}).click();
  await expect(page.locator('#nexusAnswer')).toContainText('2 workers are ready for Leeds');
  expect(capture.nexus).toBe(1);

  await page.locator('#topMenuButton').click();
  await expect(page.locator('#view-settings')).toHaveClass(/active/);
  await page.locator('#themeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  expect(failures).toEqual([]);
});

test('roster import review and Generate matches are wired',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-narrow','single-browser workflow test');
  const capture={};await mockAgencyApi(page,capture);await page.goto('/');
  await page.locator('[data-nav="workers"]').first().click();
  await expect(page.locator('#view-workers')).toHaveClass(/active/);
  await page.getByRole('button',{name:'Import',exact:true}).click();
  const csv='Name,Trade,Location,Availability,Skills,Licences\nMaya Collins,Joiner,Leeds,Available,"Second fix; Fire door installation",CSCS Blue\nNoah Ward,Joiner,Leeds,Available,Second fix,';
  await page.locator('#importFile').setInputFiles({name:'workers.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.locator('#importStatus')).toContainText('2 valid rows');
  await expect(page.locator('#importPreview .import-row')).toHaveCount(2);
  await page.locator('#confirmImport').click();
  await expect.poll(()=>capture.importBody?.records?.length||0).toBe(2);
  expect(capture.importBody.records[0].displayName).toBe('Maya Collins');

  await page.locator('[data-nav="requests"]').first().click();
  await expect(page.locator('#view-requests')).toHaveClass(/active/);
  await page.getByRole('button',{name:'Generate matches'}).click();
  await expect.poll(()=>capture.match||0).toBe(1);
  await expect(page.locator('#view-matches')).toHaveClass(/active/);
  await expect(page.locator('#matchRequestSelect')).toHaveValue(request.requestId);
  await expect(page.locator('#matchesList')).toContainText('Alex Turner');
});

test('signed Worker invite is explicit and does not imply consent',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='phone-narrow','single-browser invite workflow test');
  const capture={};await mockAgencyApi(page,capture);await page.goto('/');
  await page.locator('[data-nav="workers"]').first().click();
  await page.getByRole('button',{name:'Invite',exact:true}).click();
  await expect(page.locator('#inviteWorkerModal')).toBeVisible();
  await page.locator('#inviteRosterWorker').selectOption('r1');
  await expect(page.locator('#inviteTrade')).toHaveValue('Joiner');
  await expect(page.locator('#inviteLocation')).toHaveValue('Leeds');
  await page.locator('#createInviteLink').click();
  await expect.poll(()=>capture.inviteBody?.rosterWorkerId||'').toBe('r1');
  await expect(page.locator('#inviteStatus')).toContainText('consent has not been granted');
  await expect(page.locator('#inviteUrlText')).toContainText('work.example.invalid');
  await expect(page.locator('#whatsappInviteLink')).toHaveAttribute('href',/wa\.me/);
  await expect(page.locator('#emailInviteLink')).toHaveAttribute('href',/^mailto:/);
  expect(capture.inviteBody.trade).toBe('Joiner');
  expect(capture.inviteBody.location).toBe('Leeds');
});
