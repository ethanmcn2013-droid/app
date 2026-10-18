import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMaster3Presentation,validateMaster3ItemPresentation,validateMaster3ProjectSettings} from './master3-presentation';
import {validateAudienceTimelineDto} from './audience-timeline';
import {master3SettingsFromForm} from './master3-settings-form';
const dto={version:1,audienceKind:'module',publicationId:'public',label:'Launch',lastUpdatedAt:'2026-10-18T00:00:00Z',today:'2026-10-18',sections:[{state:'next',label:'Next',items:[{publicId:'one',title:'Open',date:'2026-10-20',state:'next'}]}]};
test('DTOv1 remains unchanged when presentation is absent',()=>assert.deepEqual(validateAudienceTimelineDto(dto),dto));
test('explicit presentation validates without modifying caller and public item ids remain opaque',()=>{
 const input={...dto,presentation:{market:'launch',place:'  The Hall  ',address:'Town',locationConsent:true,socialDetails:true,timezone:'Europe/Dublin',after:{word:' Open '}},sections:[{...dto.sections[0],items:[{...dto.sections[0].items[0],presentation:{forYou:true,note:' Guest note ',time:'14:00'}}]}]};
 const before=JSON.stringify(input),out=validateAudienceTimelineDto(input);assert.equal(JSON.stringify(input),before);assert.equal(out.presentation?.place,'The Hall');assert.equal(out.sections[0].items[0].presentation?.note,'Guest note');assert.equal(out.presentation?.after?.word,'Open');
});
for(const value of ['http://example.com','javascript:alert(1)','https://name:password@example.com'])test(`rejects unsafe presentation URL ${value.split(':')[0]}`,()=>assert.throws(()=>validateMaster3Presentation({photosUrl:value})));
test('rejects private blobs, source ids, malformed timezone, unconsented address and unsupported constraints',()=>{
 for(const p of [{privateMetadata:{}},{ownerEmail:'private@example.com'},{timezone:'No/Such'},{place:'House'},{address:'Home',locationConsent:false},{during:{days:367,word:'Open'}},{after:{word:'   '}},{next:{label:' ',url:'https://example.com'}},{photosUrl:'https://example.com/'+ 'x'.repeat(2049)}])assert.throws(()=>validateMaster3Presentation(p));
 assert.throws(()=>validateMaster3ItemPresentation({note:'x'.repeat(241)}));assert.throws(()=>validateMaster3ItemPresentation({time:'24:00'}));assert.throws(()=>validateMaster3ItemPresentation({description:'private'}));
});
test('private settings have bounded keys and one explicit final only',()=>{
 assert.throws(()=>validateMaster3ProjectSettings({items:Object.fromEntries(Array.from({length:101},(_,i)=>['item'+i,{}]))}));
 assert.throws(()=>validateMaster3ProjectSettings({items:{a:{final:true},b:{final:true}}}));assert.throws(()=>validateMaster3ProjectSettings(JSON.parse('{"items":{"__proto__":{}}}')));
});
test('owner form only accepts actual allowed milestone keys and detailed card consent is explicit',()=>{
 const form=new FormData();form.set('presentation.market','wedding');form.set('presentation.place','Hall');form.set('presentation.locationConsent','on');form.set('item.allowed.short','Short');
 const result=master3SettingsFromForm(form,['allowed']);assert.equal(result.presentation?.socialDetails,false);assert.equal(result.items?.allowed.short,'Short');form.set('item.foreign.note','private');assert.throws(()=>master3SettingsFromForm(form,['allowed']));
});
