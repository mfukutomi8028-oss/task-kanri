import { test, expect } from '@playwright/test';

const ROOM = 'test-today-sidebar-filters-v375';
const USER = 'QA375';
const OTHER = 'Peer375';
const TODAY = '#todayView';
const BANNER = `${TODAY} [data-today-filter-summary-v375]`;

async function openMenu(page, width) {
  if (width > 860) return;
  const trigger=page.locator('.work-mobile-menu-button');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
}
async function closeMenu(page,width) {
  if (width > 860) return;
  const trigger=page.locator('.work-mobile-menu-button');
  if (await trigger.getAttribute('aria-expanded') === 'true') await trigger.click();
}
async function selectSidebar(page, width, id, value) {
  await openMenu(page,width);
  await expect(page.locator(id)).toBeVisible();
  await page.locator(id).selectOption(value);
  await closeMenu(page,width);
}
async function clickSidebar(page,width,selector) {
  await openMenu(page,width);
  await page.locator(selector).click();
  await closeMenu(page,width);
}
async function boot(page,width) {
  await page.setViewportSize({width,height:900});
  await page.route('**/*', route => {
    const url=new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(({room,user,other}) => {
    Object.defineProperty(window,'firebaseConfig',{configurable:true,get(){return null;},set(){}});
    if(localStorage.getItem('v375-fixture-ready')==='1')return;
    localStorage.clear();
    localStorage.setItem('systemTaskUser',user);
    localStorage.setItem('systemTaskRoomId',room);
    localStorage.setItem('work-board-desktop-sidebar-pinned-v158','1');
    localStorage.setItem(`system-task-users:${room}`,JSON.stringify([user,other]));
    const now=new Date();
    const pad=v=>String(v).padStart(2,'0');
    const today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const task=(id,assignee,category)=>({
      id,title:`V375 ${id}`,status:'\u672a\u7740\u624b',assignee,category,
      priority:'\u4e2d',description:'',requester:'',tags:[],dueDate:today,dueTime:'',
      pinned:false,checklist:[],comments:[],history:[],recurrence:'none',
      revision:1,completedAt:0,completedMemo:'',createdBy:user,updatedBy:user,
      createdAt:Date.now()-1000,updatedAt:Date.now()
    });
    const schedule=(id,assignee,category,hour)=>({
      id,title:`V375 ${id}`,assignee,category,startAt:new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour).toISOString(),
      endAt:new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour+1).toISOString(),
      location:'',memo:'',relatedTaskId:'',revision:1,createdAt:Date.now()-1000,updatedAt:Date.now()
    });
    localStorage.setItem(`system-task-tasks:${room}`,JSON.stringify([
      task('mine-pc',user,'PC'),task('peer-other',other,'\u305d\u306e\u4ed6'),
      task('mine-other',user,'\u305d\u306e\u4ed6'),task('peer-pc',other,'PC')
    ]));
    localStorage.setItem(`system-task-schedules:${room}`,JSON.stringify([
      schedule('mine-pc-meeting',user,'PC',9),schedule('peer-other-meeting',other,'\u305d\u306e\u4ed6',10),
      schedule('mine-other-meeting',user,'\u305d\u306e\u4ed6',11),schedule('peer-pc-meeting',other,'PC',12)
    ]));
    localStorage.setItem('v375-fixture-ready','1');
  },{room:ROOM,user:USER,other:OTHER});
  await page.goto(`/?room=${ROOM}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.WORK_BOARD_ASSETS_READY === true,undefined,{timeout:30_000});
  await page.waitForFunction(() => document.documentElement.dataset.firstPaintVersion === window.WORK_BOARD_RELEASE.version);
  await expect(page.locator(TODAY)).toBeVisible();
  await expect(page.locator(`${TODAY} [data-task-id="mine-pc"]`)).toBeVisible();
  await expect(page.locator(`${TODAY} [data-schedule-id="peer-pc-meeting"]`)).toBeVisible();
}
async function visible(page, ids,kind='task') {
  for(const id of ids)await expect(page.locator(`${TODAY} [data-${kind}-id="${id}"]`)).toBeVisible();
}
async function absent(page, ids,kind='task') {
  for(const id of ids)await expect(page.locator(`${TODAY} [data-${kind}-id="${id}"]`)).toHaveCount(0);
}

for(const width of [1366,390]) {
  test(`Ver.375 assignee filters both Today tasks and schedules (${width}px)`,async({page})=>{
    await boot(page,width);
    await expect(page.locator(BANNER)).toHaveCount(0);
    await selectSidebar(page,width,'#assigneeFilter',USER);
    await visible(page,['mine-pc','mine-other']);
    await absent(page,['peer-pc','peer-other']);
    await visible(page,['mine-pc-meeting','mine-other-meeting'],'schedule');
    await absent(page,['peer-pc-meeting','peer-other-meeting'],'schedule');
    const banner=page.locator(BANNER);
    await expect(banner).toContainText(USER);
    await expect(banner).toContainText('ToDo');
    await expect(page.locator(`${TODAY} .activity-panel`)).toBeVisible();
    await expect(page.locator(`${TODAY} .today-todo-preview`)).toBeVisible();
  });

  test(`Ver.375 category and mine intersection use canonical Today scope (${width}px)`,async({page})=>{
    await boot(page,width);
    await selectSidebar(page,width,'#categoryFilter','PC');
    await visible(page,['mine-pc','peer-pc']);
    await absent(page,['mine-other','peer-other']);
    await visible(page,['mine-pc-meeting','peer-pc-meeting'],'schedule');
    await absent(page,['mine-other-meeting','peer-other-meeting'],'schedule');
    await clickSidebar(page,width,'.nav-item[data-filter="mine"]');
    await visible(page,['mine-pc']);
    await absent(page,['peer-pc','mine-other','peer-other']);
    await visible(page,['mine-pc-meeting'],'schedule');
    await absent(page,['peer-pc-meeting','mine-other-meeting','peer-other-meeting'],'schedule');
    await expect(page.locator(BANNER)).toContainText('PC');
  });

  test(`Ver.375 empty intersection clarifies filtering and Enter clears without task writes (${width}px)`,async({page})=>{
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await boot(page,width);
    const old=await page.evaluate(room=>[localStorage.getItem(`system-task-tasks:${room}`),localStorage.getItem(`system-task-schedules:${room}`)],ROOM);
    await selectSidebar(page,width,'#assigneeFilter',USER);
    await selectSidebar(page,width,'#categoryFilter','\u30cd\u30c3\u30c8\u30ef\u30fc\u30af');
    await absent(page,['mine-pc','mine-other','peer-pc','peer-other']);
    await absent(page,['mine-pc-meeting','mine-other-meeting','peer-pc-meeting','peer-other-meeting'],'schedule');
    await expect(page.locator(`${TODAY} .today-panel-body [data-fixture-unexpected]`)).toHaveCount(0);
    await expect(page.locator(`${TODAY} .today-panel-body .today-empty`).first()).toContainText('\u8868\u793a\u6761\u4ef6');
    const clear=page.locator(`${BANNER} [data-today-filter-clear-v375]`);
    await expect(clear).toBeVisible();
    await clear.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(BANNER)).toHaveCount(0);
    await visible(page,['mine-pc','peer-pc','mine-other','peer-other']);
    await visible(page,['mine-pc-meeting','peer-pc-meeting','mine-other-meeting','peer-other-meeting'],'schedule');
    const now=await page.evaluate(room=>[localStorage.getItem(`system-task-tasks:${room}`),localStorage.getItem(`system-task-schedules:${room}`)],ROOM);
    expect(now).toEqual(old);
    expect(errors).toEqual([]);
  });

  test(`Ver.375 Today filter remains understandable across Schedule navigation (${width}px)`,async({page})=>{
    await boot(page,width);
    await selectSidebar(page,width,'#categoryFilter','PC');
    await expect(page.locator(BANNER)).toBeVisible();
    await clickSidebar(page,width,'.nav-item[data-layout="schedule"]');
    await expect(page.locator('#scheduleView')).toBeVisible();
    await clickSidebar(page,width,'.nav-item[data-layout="today"]');
    await expect(page.locator(TODAY)).toBeVisible();
    await expect(page.locator(BANNER)).toContainText('PC');
    await absent(page,['peer-other','mine-other']);
    if(width<=860)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  });
}
