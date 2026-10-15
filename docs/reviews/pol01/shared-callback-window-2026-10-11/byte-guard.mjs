import fs from 'node:fs';import crypto from 'node:crypto';import ts from 'typescript';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const evidence='docs/reviews/pol01/shared-callback-window-2026-10-11';
const before=fs.readFileSync(evidence+'/before/apps/web/src/app/workspace.ts','utf8'),after=fs.readFileSync('apps/web/src/app/workspace.ts','utf8');
function bodies(text){const s=ts.createSourceFile('x.ts',text,ts.ScriptTarget.Latest,true);const out=new Map();function walk(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))out.set(n.name.text,n.initializer.body.getText(s));ts.forEachChild(n,walk)}walk(s);return out;}
const a=bodies(before),b=bodies(after),expected=fs.readFileSync('.superpowers/sdd/2026-10-10-kn01/web-window-repair-r2/unchanged-methods.sha256','utf8').split('\n').filter(x=>x.includes('apps/web/src/app/workspace.ts#'));
for(const row of expected){const [digest,label]=row.split(/\s+/),name=label.split('#')[1];if(a.get(name)!==b.get(name))throw Error('changed old Workspace body '+name);if(!a.has(name))throw Error('missing '+name);console.log('PASS old Workspace body exact before/after '+name+' SHA '+sha(b.get(name))+' KNref '+digest)}
console.log('PASS old Workspace bodies '+expected.length);
for(const p of ['apps/web/src/api/client.ts','apps/web/src/features/annotations/controller.ts','packages/service/src/planning.ts','packages/service/src/workspace.ts','packages/service/src/structure-sync.ts']){
 const oldPath=evidence+'/before/'+p;if(fs.existsSync(oldPath)){if(sha(fs.readFileSync(oldPath))!==sha(fs.readFileSync(p)))throw Error('changed dependency '+p);console.log('PASS unchanged dependency '+p+' '+sha(fs.readFileSync(p)));}}
const original=fs.readFileSync(evidence+'/before/tests/e2e/planning.spec.mjs','utf8');let mechanical=original;
for(const [old,newer]of [['getByLabel("Directory scope",','getByLabel("Path prefix",'],['getByLabel("Responsibility",','getByLabel("Purpose",'],['getByLabel("Forbidden dependencies (one directory per line)",','getByLabel("Forbidden dependencies",'],['name: "Save directory policy",','name: "Save policy",']])mechanical=mechanical.replaceAll(old,newer);
mechanical=mechanical.replace('name: "Directory responsibilities",','name: "Edit policy",').replace('.selectOption(policy.id);','.selectOption(`legacy:${policy.id}`);');
const read='    await page\n      .getByRole("button", { name: "Read structure again", exact: true })\n      .click();\n    await expect(\n      page.getByRole("button", { name: "Save policy", exact: true }),\n    ).toBeEnabled();';
const row='    const [policy] = await api(`/api/projects/${project.id}/policies`);';
mechanical=mechanical.replace(row,row+'\n'+read+'\n    expect((await detail()).plan.revision).toBe(beforeKnowledge.plan.revision);');
const assertion='      prohibited.issues.some((issue) => issue.code === "FORBIDDEN_DEPENDENCY"),\n    ).toBe(true);';
mechanical=mechanical.replace(assertion,assertion+'\n'+read+'\n    expect((await detail()).plan.revision).toBe(prohibited.plan.revision);');
const oldNegative='    expect(\n      (await mcp.call("get_approved_plan", { ...args, planId })).valid,\n    ).toBe(false);';
const newNegative='    const deniedApproval = await mcp.client.callTool({\n      name: "get_approved_plan",\n      arguments: { ...args, planId },\n    });\n    expect(deniedApproval.isError).toBe(true);\n    expect(JSON.parse(deniedApproval.content[0].text)).toMatchObject({\n      code: "NOT_APPROVED",\n      status: 409,\n    });';
mechanical=mechanical.replace(oldNegative,newNegative);
if(fs.readFileSync(evidence+'/planning-complete-flow-before-typed-collector.mjs','utf8')!==mechanical)throw Error('nonapproved precollector planning change');console.log('PASS whole planning exact authorized locator mappings + two explicit reads; ALL original assertions exact except specifically authorized stronger SDK NOT_APPROVED409 negative; original SHA '+sha(original));

const browserBefore=fs.readFileSync(evidence+'/before/tests/e2e/pol01-structure.spec.ts','utf8');
let browserExpected=browserBefore.replace('  await f.json(`/api/projects/${f.project.id}/view`, "PUT", { locale: "en" });','  await f.json(`/api/projects/${f.project.id}/view`, "PUT", {\n    positions: {},\n    theme: "light",\n    locale: "en",\n  });');
browserExpected=browserExpected.replaceAll('r.url().endsWith(`/api/projects/${f.project.id}/','r.url().endsWith(`/api/projects/${encodeURIComponent(f.project.id)}/');
const prettier=await import('prettier');browserExpected=await prettier.format(browserExpected,{parser:'typescript'});
if(browserExpected!==fs.readFileSync('tests/e2e/pol01-structure.spec.ts','utf8'))throw Error('nonauthorized native browser fixture change');
console.log('PASS original native browser fixture exact fullviewshape + 4 encoded response predicates + formatting; ALL domain assertions preserved '+sha(browserBefore));

function assertions(text){const file=ts.createSourceFile('x.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),out=[];function walk(n){if(ts.isExpressionStatement(n)){const t=n.getText(file);if(/^(?:await\s+)?expect(?:\(|\s|\.)/.test(t))out.push(t)}ts.forEachChild(n,walk)}walk(file);return out;}
const currentPlanning=fs.readFileSync('tests/e2e/planning.spec.mjs','utf8'), currentAssertions=assertions(currentPlanning);
const precollectorAssertions=assertions(mechanical);
for(const a of precollectorAssertions)if(!currentAssertions.includes(a))throw Error('collector changed domain assertion '+a);
console.log('PASS collector preserves all '+precollectorAssertions.length+' authorized precollector domain/positive/history/revision/error assertion statements; original errors[] assertion remains exact');
