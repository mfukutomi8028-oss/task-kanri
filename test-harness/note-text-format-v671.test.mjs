import assert from 'node:assert/strict';
import test from 'node:test';
await import('../note-text-format-v671.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
});
const model=()=> {
  assert.ok(globalThis.WorkBoardNoteTextFormatV671, 'format range model is registered');
  return globalThis.WorkBoardNoteTextFormatV671;
};
test('styles only the selected text, composes independent marks and clears just a subset',()=>{
  const f=model(),text='赤 青 緑';
  let v=f.apply(text,null,0,3,{flags:1,color:'red'});
  v=f.apply(text,v,2,5,{size:'large'});
  assert.deepEqual(f.read(text,v),[
    {start:0,end:2,flags:1,color:'red'},{start:2,end:3,flags:1,color:'red',size:'large'},{start:3,end:5,size:'large'}
  ]);
  assert.equal(f.hasFlag(text,v,0,3,1),true);
  assert.equal(f.hasFlag(text,v,1,4,1),false);
  v=f.apply(text,v,1,4,{clear:true});
  assert.deepEqual(f.read(text,v),[{start:0,end:1,flags:1,color:'red'},{start:4,end:5,size:'large'}]);
});
test('rejects stale ranges, unknown styles, overlap and offsets splitting a surrogate',()=>{
  const f=model(),text='例😀例';
  assert.deepEqual(f.read(text,{text,runs:[{start:0,end:1,color:'email-blue'}]}),[]);
  assert.deepEqual(f.read(text,{text,runs:[{start:0,end:3,flags:1},{start:1,end:3,flags:2}]}),[]);
  assert.deepEqual(f.read(text,{text,runs:[{start:2,end:3,flags:1}]}),[]);
  const v=f.apply(text,null,2,3,{flags:1});
  assert.deepEqual(f.read(text,v),[{start:1,end:3,flags:1}]);
  assert.deepEqual(f.read('例😀昔',v),[]);
  assert.deepEqual(f.read(text,undefined),[]);
});
test('keeps unchanged runs through edits and drops markings with ambiguous repeated-text alignment',()=>{
  const f=model(),text='重要😀優先';
  const v=f.apply(text,null,0,text.length,{color:'blue'});
  const after='重要確認優先';
  assert.deepEqual(f.read(after,f.retarget(text,after,v)),[{start:0,end:2,color:'blue'},{start:4,end:6,color:'blue'}]);
  const before='同同同末',amb='同同末',v2=f.apply(before,null,1,2,{flags:1});
  assert.equal(f.retarget(before,amb,v2),null);
  const known=f.retarget(before,amb,v2,{start:0,end:1});
  assert.deepEqual(f.read(amb,known),[{start:0,end:1,flags:1}]);
});
test('adjacent equivalent runs merge and never replace the plain-text body',()=>{
  const f=model(),text='<img>& 文';
  const first=f.apply(text,null,0,4,{flags:1});
  const more=f.apply(text,first,4,5,{flags:1});
  const last=f.apply(text,more,1,4,{removeFlag:1});
  assert.equal(more.text,text);
  assert.deepEqual(more.runs,[{start:0,end:5,flags:1}]);
  assert.deepEqual(last.runs,[{start:0,end:1,flags:1},{start:4,end:5,flags:1}]);
  assert.equal(f.apply(text,more,0,5,{clear:true}),null);
});

test('larger heading sizes round-trip as bounded metadata without changing legacy marks',()=>{
  const f=model(),text='重要 通常';
  for(const size of ['xlarge','xxlarge','huge','display']){
    const v=f.apply(text,null,0,2,{flags:1,color:'red',size});
    assert.deepEqual(f.read(text,v),[{start:0,end:2,flags:1,color:'red',size}]);
    assert.deepEqual(f.read(text,f.apply(text,v,0,2,{size:null})),[{start:0,end:2,flags:1,color:'red'}]);
  }
  const prior={text,runs:[{start:0,end:2,size:'large'},{start:3,end:5,size:'small'}]};
  assert.deepEqual(f.read(text,prior),prior.runs);
  assert.deepEqual(f.read(text,{text,runs:[{start:0,end:2,size:'999px'}]}),[]);
});
