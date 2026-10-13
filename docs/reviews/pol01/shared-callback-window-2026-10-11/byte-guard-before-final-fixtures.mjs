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
if(fs.readFileSync('tests/e2e/planning.spec.mjs','utf8')!==mechanical)throw Error('nonlocator planning change');console.log('PASS whole planning exact four locator-name mechanical mapping original SHA '+sha(original));
