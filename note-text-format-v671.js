/* Note formatting is metadata bound to exact canonical plain text.
 * Shared by canonical memo/sticky writers and Origin's presentation only. */
(function installNoteTextFormatV671(root){
  'use strict';
  if(root.WorkBoardNoteTextFormatV671)return;
  const COLORS=Object.freeze(['red','blue','green','purple','amber']);
  const SIZES=Object.freeze(['small','large']);
  const MAX_RUNS=512, MAX_TEXT=6000, ALL_FLAGS=15;
  const plain=(v)=>typeof v==='string'&&v.length<=MAX_TEXT;
  const codeUnitBoundary=(text,n)=>!(n>0&&n<text.length
    &&text.charCodeAt(n-1)>=0xd800&&text.charCodeAt(n-1)<=0xdbff
    &&text.charCodeAt(n)>=0xdc00&&text.charCodeAt(n)<=0xdfff);
  const flagsValid=n=>Number.isInteger(n)&&n>=0&&n<=ALL_FLAGS;
  const matches=(a,b)=>a.flags===b.flags&&a.color===b.color&&a.size===b.size;
  const append=(runs,start,end,style)=>{
    if(start>=end||!style||!(style.flags||style.color||style.size))return;
    const previous=runs.at(-1);
    if(previous?.end===start&&matches(previous,style)){previous.end=end;return;}
    runs.push({start,end,...(style.flags?{flags:style.flags}:{}),
      ...(style.color?{color:style.color}:{}),...(style.size?{size:style.size}:{})});
  };
  function read(text,value){
    if(!plain(text)||!value||typeof value!=='object'||Array.isArray(value)||value.text!==text
      ||!Array.isArray(value.runs)||value.runs.length>MAX_RUNS)return [];
    const result=[];
    let cursor=0;
    for(const v of value.runs){
      if(!v||typeof v!=='object'||Array.isArray(v)||!Number.isInteger(v.start)||!Number.isInteger(v.end)
        ||v.start<cursor||v.end<=v.start||v.end>text.length
        ||!codeUnitBoundary(text,v.start)||!codeUnitBoundary(text,v.end)
        ||(v.flags!==undefined&&!flagsValid(v.flags))
        ||(v.color!==undefined&&!COLORS.includes(v.color))
        ||(v.size!==undefined&&!SIZES.includes(v.size)))return [];
      append(result,v.start,v.end,{flags:v.flags||undefined,color:v.color,size:v.size});
      cursor=v.end;
    }
    return result;
  }
  function envelope(text,runs){
    const clean=read(text,{text,runs});
    return clean.length?{text,runs:clean}:null;
  }
  function selection(text,start,end){
    if(!plain(text)||!Number.isInteger(start)||!Number.isInteger(end)
      ||start<0||end>text.length||start>=end)return null;
    return [codeUnitBoundary(text,start)?start:start-1,codeUnitBoundary(text,end)?end:end+1];
  }
  function hasFlag(text,value,start,end,flag){
    const selected=selection(text,start,end);
    if(!selected||!flag||!flagsValid(flag))return false;
    let offset=selected[0];
    for(const r of read(text,value)){
      if(r.end<=offset)continue;
      if(r.start>offset||!(r.flags&flag))return false;
      offset=r.end;
      if(offset>=selected[1])return true;
    }
    return false;
  }
  function apply(text,value,start,end,patch){
    const prior=read(text,value),selected=selection(text,start,end);
    if(!selected)return envelope(text,prior);
    [start,end]=selected;
    const edges=[...new Set([start,end,...prior.flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
    const result=[];
    let cursor=0;
    for(let i=0;i<edges.length-1;i++){
      const a=edges[i],b=edges[i+1];
      while(prior[cursor]?.end<=a)cursor++;
      const prev=prior[cursor]?.start<=a?prior[cursor]:{};
      if(a<start||b>end){append(result,a,b,prev);continue;}
      if(patch.clear)continue;
      const mask=((prev.flags||0)|(flagsValid(patch.flags)?patch.flags:0))
        &~(flagsValid(patch.removeFlag)?patch.removeFlag:0);
      const color=patch.color===null?undefined:(COLORS.includes(patch.color)?patch.color:prev.color);
      const size=patch.size===null?undefined:(SIZES.includes(patch.size)?patch.size:prev.size);
      append(result,a,b,{flags:mask||undefined,color,size});
    }
    // Never discard earlier formatting if a toolbar command would exceed the cap.
    return envelope(text,result.length>MAX_RUNS?prior:result);
  }
  function retarget(oldText,newText,value,known=null){
    const runs=read(oldText,value);
    if(!runs.length||!plain(newText))return null;
    if(oldText===newText)return envelope(newText,runs);
    const m=oldText.length,n=newText.length,max=Math.min(m,n);
    let prefix=0,suffix=0;
    const knownStart=known?.start,knownEnd=known?.end,tailLength=m-knownEnd;
    if(Number.isInteger(knownStart)&&Number.isInteger(knownEnd)
      &&knownStart>=0&&knownEnd>=knownStart&&knownEnd<=m&&n>=knownStart+tailLength
      &&newText.startsWith(oldText.slice(0,knownStart))
      &&newText.endsWith(oldText.slice(knownEnd))){
      prefix=knownStart;suffix=tailLength;
    }else{
      while(prefix<max&&oldText[prefix]===newText[prefix])prefix++;
      while(suffix<max&&oldText[m-suffix-1]===newText[n-suffix-1])suffix++;
      if(prefix+suffix>max){
        // If repeated text makes the changed position ambiguous, keep only
        // the prefix/suffix outside every possible location of the edit.
        [prefix,suffix]=[max-suffix,max-prefix];
      }
    }
    while(prefix>0&&(!codeUnitBoundary(oldText,prefix)||!codeUnitBoundary(newText,prefix)))prefix--;
    while(suffix>0&&(!codeUnitBoundary(oldText,m-suffix)||!codeUnitBoundary(newText,n-suffix)))suffix--;
    const result=[],shift=n-m;
    for(const r of runs){
      append(result,r.start,Math.min(r.end,prefix),r);
      append(result,Math.max(r.start,m-suffix)+shift,r.end+shift,r);
    }
    return envelope(newText,result);
  }
  root.WorkBoardNoteTextFormatV671=Object.freeze({COLORS,SIZES,read,envelope,apply,hasFlag,retarget});
})(globalThis);
