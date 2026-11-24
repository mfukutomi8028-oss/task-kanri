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
  await note.evaluate((el,[a,b])=>el.setSelectionRange(a,b),[start,end]);
  return note;
}

test('formats only selected words, keeps selection and wraps controls at 320px',async({page})=>{
  await boot(page);
  const note=await select(page,3,5);
  await page.getByRole('button',{name:'太字',exact:true}).click();
  await expect(page.locator('.origin-note-format-preview strong')).toHaveText('太字');
  await expect(note).toBeFocused();
  expect(await note.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([3,5]);
  await page.getByRole('combobox',{name:'文字色'}).selectOption('red');
  await page.getByRole('combobox',{name:'文字サイズ'}).selectOption('large');
  await expect(page.locator('.origin-note-format-preview [data-note-format-color=red][data-note-format-size=large]')).toHaveText('太字');
  await expect(note).toHaveValue('共通 太字 文字');
  const geometry=await page.locator('.origin-note-format-tools').evaluate(e=>({
    overflow:document.documentElement.scrollWidth>innerWidth,
    minHit:Math.min(...[...e.querySelectorAll('button,select')].map(x=>x.getBoundingClientRect().height)),
  }));
  expect(geometry).toEqual({overflow:false,minHit:44});
  await page.getByRole('button',{name:'書式を解除する'}).click();
  await expect(page.locator('.origin-note-format-preview')).toBeHidden();
});
test('IME composition does not publish an intermediate draft; preview is inert text',async({page})=>{
  await boot(page,390);
  const note=await select(page,3,5);
  await page.getByRole('button',{name:'太字',exact:true}).click();
  await page.getByRole('button',{name:'斜体',exact:true}).click();
  await expect(page.locator('.origin-note-format-preview em')).toHaveText('太字');
  const result=await note.evaluate(el=>{
    const original=window.changes.length;
    el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));
    el.selectionStart=el.selectionEnd=el.value.length;
    el.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,inputType:'insertCompositionText',isComposing:true,data:'あ'}));
    el.value+='あ';
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',isComposing:true,data:'あ'}));
    const during=window.changes.length-original;
    el.value='共通 太字 文字<img>';
    el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'<img>'}));
    return {during,after:window.changes.length-original};
  });
  expect(result).toEqual({during:0,after:1});
  await expect(page.locator('.origin-note-format-preview strong')).toHaveText('太字');
  await expect(page.locator('.origin-note-format-preview')).toContainText('<img>');
  await expect(page.locator('.origin-note-format-preview img')).toHaveCount(0);
});
