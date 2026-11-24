import {selectNoteText} from './helpers/origin-note-editing.mjs';
import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

async function boot(page,width=320) {
  await page.setViewportSize({width,height:720});
  await page.setContent('<style>*{box-sizing:border-box}main{max-width:100%;padding:8px}textarea{display:block;width:100%}</style><main><label for="note">本文</label><textarea id="note">共通 太字 文字</textarea></main>');
  for(const file of ['note-text-format-v671.js','origin-note-editor-v671.js']){
    const source=path.resolve(file);
    if(existsSync(source))await page.addScriptTag({path:source});
  }
  await page.evaluate(()=>{
    const editor=window.WorkBoardOriginNoteEditorV671;
    window.changes=[];
    if(editor)window.noteEditor=editor.attach(document.querySelector('textarea'),{onChange:d=>window.changes.push(d)});
  });
}
async function select(page,start,end){
  const note=page.getByRole('textbox',{name:'本文'});
  await note.focus();
  await selectNoteText(note,start,end);
  return note;
}

test('formats only selected words, keeps selection and wraps controls at 320px',async({page})=>{
  await boot(page);
  const note=await select(page,3,5);
  await page.getByRole('button',{name:'太字',exact:true}).click();
  await expect(note.locator('strong')).toHaveText('太字');
  await expect(note).toBeFocused();
  expect(await page.evaluate(()=>window.noteEditor.getSelection())).toEqual({start:3,end:5,backward:false});
  await page.getByRole('combobox',{name:'文字色'}).selectOption('red');
  await page.getByRole('combobox',{name:'文字サイズ'}).selectOption('large');
  await expect(note.locator('[data-note-format-color=red][data-note-format-size=large]')).toHaveText('太字');
  await expect(note).toHaveText('共通 太字 文字');
  await expect(page.locator('textarea')).toHaveValue('共通 太字 文字');
  const geometry=await page.locator('.origin-note-format-tools').evaluate(e=>({
    overflow:document.documentElement.scrollWidth>innerWidth,
    minHit:Math.min(...[...e.querySelectorAll('button,select')].map(x=>x.getBoundingClientRect().height)),
  }));
  expect(geometry).toEqual({overflow:false,minHit:44});
  await page.getByRole('button',{name:'書式を解除する'}).click();
  await expect(note.locator('strong,[data-note-format-color],[data-note-format-size]')).toHaveCount(0);
  await expect(page.locator('.origin-note-format-preview')).toHaveCount(0);
});
test('IME composition does not publish an intermediate draft; the editor is inert text',async({page})=>{
  await boot(page,390);
  const note=await select(page,3,5);
  await page.getByRole('button',{name:'太字',exact:true}).click();
  await page.getByRole('button',{name:'斜体',exact:true}).click();
  await expect(note.locator('em')).toHaveText('太字');
  await selectNoteText(note,'共通 太字 文字'.length);
  const result=await note.evaluate(el=>{
    const original=window.changes.length;
    el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));
    el.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,inputType:'insertCompositionText',isComposing:true,data:'あ'}));
    const composing=document.createTextNode('あ');el.append(composing);
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',isComposing:true,data:'あ'}));
    const during=window.changes.length-original;
    composing.data='<img>';
    el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'<img>'}));
    return {during,after:window.changes.length-original};
  });
  expect(result).toEqual({during:0,after:1});
  await expect(note.locator('strong')).toHaveText('太字');
  await expect(note).toContainText('<img>');
  await expect(note.locator('img')).toHaveCount(0);
});

test('direct editor preserves plain backing text, multiline insertion, caret scroll and undo',async({page})=>{
 await boot(page,390);
 const note=page.getByRole('textbox',{name:'本文'});
 await selectNoteText(note,3,5);
 await page.getByRole('button',{name:'太字',exact:true}).click();
 await selectNoteText(note,0);
 await page.keyboard.insertText('確認：');
 await expect(note.locator('strong')).toHaveText('太字');
 await note.press('Control+z');
 await expect(note).toHaveText('共通 太字 文字');
 await note.press('Control+Shift+z');
 await expect(note).toHaveText('確認：共通 太字 文字');
 await note.fill('一行目\n二行目\n');
 await page.keyboard.insertText('三行目');
 await expect(page.locator('textarea')).toHaveValue('一行目\n二行目\n三行目');
 await note.evaluate(el=>{el.style.height='110px';el.style.minHeight='0';});
 const long=Array.from({length:40},(_,i)=>'確認項目 '+i).join('\n');
 await note.fill(long);
 await expect.poll(()=>note.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await expect(page.locator('textarea')).toHaveValue(long);
});
