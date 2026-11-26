// Server-side format/size verification, not malware scanning. Files must be
// served as downloads until a separate safe rendering pipeline is available.
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';

export const MESSAGING_ATTACHMENT_MAX_BYTES=5000000;
const MAX_PIXELS=40000000, MAX_ZIP_BYTES=40000000, MAX_ZIP_ENTRIES=2048;
const office={
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['docx','word/document.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['xlsx','xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':['pptx','ppt/presentation.xml','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml']
};
const extensions=Object.freeze({'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp'],'application/pdf':['pdf'],'text/plain':['txt'],'text/csv':['csv'],...Object.fromEntries(Object.entries(office).map(([mime,[ext]])=>[mime,[ext]]))});
const invalid=()=>{throw new TypeError('Invalid attachment content');};
const dimensions=(w,h)=>{if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w*h>MAX_PIXELS)invalid();};
const utf8=buffer=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch(_){return invalid();}};
const crcTable=Uint32Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=n&1?(n>>>1)^0xedb88320:n>>>1;return n>>>0;});
function crc32(buffer){let n=0xffffffff;for(const value of buffer)n=crcTable[(n^value)&255]^(n>>>8);return (n^0xffffffff)>>>0;}

function png(b){
  if(b.length<45||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))invalid();
  let offset=8,first=true,hasData=false;
  while(offset+12<=b.length){
    const length=b.readUInt32BE(offset),end=offset+12+length,type=b.toString('ascii',offset+4,offset+8);
    if(end>b.length||!/^[A-Za-z]{4}$/.test(type)||crc32(b.subarray(offset+4,end-4))!==b.readUInt32BE(end-4))invalid();
    if(first){if(type!=='IHDR'||length!==13)invalid();dimensions(b.readUInt32BE(offset+8),b.readUInt32BE(offset+12));first=false;}
    else if(type==='IHDR')invalid();
    if(type==='IDAT'&&length>0)hasData=true;
    if(type==='IEND'){if(length!==0||!hasData||end!==b.length)invalid();return;}
    offset=end;
  }
  invalid();
}
function jpeg(b){
  if(b.length<16||b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)invalid();
  let i=2,hasDimensions=false;
  while(i<b.length-2){
    if(b[i++]!==255)invalid();while(b[i]===255)i++;
    const marker=b[i++];if(i+2>b.length||marker===0||marker===216||marker===217||marker>=208&&marker<=215)invalid();
    const size=b.readUInt16BE(i);if(size<2||i+size>b.length-2)invalid();
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
      if(size<8)invalid();dimensions(b.readUInt16BE(i+5),b.readUInt16BE(i+3));hasDimensions=true;
    }
    if(marker===218){if(!hasDimensions||size<6||i+size>=b.length-2)invalid();return;}
    i+=size;
  }
  invalid();
}
function webp(b){
  if(b.length<26||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP'||b.readUInt32LE(4)+8!==b.length)invalid();
  let i=12,hasImage=false;
  while(i+8<=b.length){
    const type=b.toString('ascii',i,i+4),n=b.readUInt32LE(i+4),start=i+8,end=start+n;
    if(end+(n%2)>b.length)invalid();
    if(type==='VP8 '){if(n<10||b[start+3]!==157||b[start+4]!==1||b[start+5]!==42)invalid();dimensions(b.readUInt16LE(start+6)&16383,b.readUInt16LE(start+8)&16383);hasImage=true;}
    if(type==='VP8L'){if(n<5||b[start]!==47)invalid();const packed=b.readUInt32LE(start+1);dimensions((packed&16383)+1,((packed>>>14)&16383)+1);hasImage=true;}
    if(type==='VP8X'){if(n!==10||b[start]&2)invalid();dimensions(b.readUIntLE(start+4,3)+1,b.readUIntLE(start+7,3)+1);}
    i=end+(n%2);
  }
  if(i!==b.length||!hasImage)invalid();
}
function pdf(b){
  if(!/^%PDF-[12]\.[0-9](?:\r\n|\r|\n)/.test(b.toString('ascii',0,12))||!/%%EOF[\x00\x09\x0a\x0c\x0d\x20]*$/.test(b.toString('latin1',Math.max(0,b.length-1024))))invalid();
}
function text(b){
  const value=utf8(b);if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))invalid();
}
function validateZipName(name){
  if(!name||name.length>512||name.startsWith('/')||/[\\:\u0000-\u001f\u007f]/.test(name)||name.replace(/\/$/,'').split('/').some(part=>!part||part==='.'||part==='..')||/(?:^|\/)(?:activex|embeddings|externallinks)(?:\/|$)|vbaproject|vbadata|\.(?:exe|dll|js|vbs|ps1|bat|cmd|com|scr|msi|hta|html|svg|zip|7z|rar|docm|xlsm|pptm)$/i.test(name))invalid();
}
function validateOffice(b,[,mainPart,mainType]){
  if(b.length<22)invalid();let end=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}}
  if(end<0||b.readUInt16LE(end+4)!==0||b.readUInt16LE(end+6)!==0)invalid();
  const count=b.readUInt16LE(end+10),start=b.readUInt32LE(end+16),size=b.readUInt32LE(end+12);
  if(count<1||count>MAX_ZIP_ENTRIES||count!==b.readUInt16LE(end+8)||start+size!==end)invalid();
  let i=start,total=0,manifest=null,main=false;const names=new Set(),ranges=[];
  for(let entry=0;entry<count;entry++){
    if(i+46>end||b.readUInt32LE(i)!==0x02014b50)invalid();
    const flags=b.readUInt16LE(i+8),method=b.readUInt16LE(i+10),crc=b.readUInt32LE(i+16),compressed=b.readUInt32LE(i+20),expanded=b.readUInt32LE(i+24),nameLength=b.readUInt16LE(i+28),extraLength=b.readUInt16LE(i+30),commentLength=b.readUInt16LE(i+32),local=b.readUInt32LE(i+42),next=i+46+nameLength+extraLength+commentLength;
    if(next>end||flags&~0x80e||![0,8].includes(method)||b.readUInt16LE(i+34)!==0||((b.readUInt32LE(i+38)>>>16)&0xf000)===0xa000||local+30>start||expanded>MAX_ZIP_BYTES-total)invalid();
    const nameBytes=b.subarray(i+46,i+46+nameLength),name=utf8(nameBytes),key=name.toLowerCase();validateZipName(name);if(names.has(key))invalid();names.add(key);
    if(b.readUInt32LE(local)!==0x04034b50||b.readUInt16LE(local+6)!==flags||b.readUInt16LE(local+8)!==method||b.readUInt16LE(local+26)!==nameLength||!b.subarray(local+30,local+30+nameLength).equals(nameBytes))invalid();
    const dataStart=local+30+nameLength+b.readUInt16LE(local+28),dataEnd=dataStart+compressed;
    if(dataStart>start||dataEnd>start)invalid();let localEnd=dataEnd;
    if(flags&8){
      if(dataEnd+12>start)invalid();let descriptor=dataEnd;
      if(b.readUInt32LE(descriptor)===0x08074b50)descriptor+=4;
      if(descriptor+12>start||b.readUInt32LE(descriptor)!==crc||b.readUInt32LE(descriptor+4)!==compressed||b.readUInt32LE(descriptor+8)!==expanded)invalid();localEnd=descriptor+12;
    }else if(b.readUInt32LE(local+14)!==crc||b.readUInt32LE(local+18)!==compressed||b.readUInt32LE(local+22)!==expanded)invalid();
    const raw=b.subarray(dataStart,dataEnd);let decoded;
    try{decoded=method===0?raw:inflateRawSync(raw,{maxOutputLength:Math.max(1,expanded)});}catch(_){invalid();}
    if(decoded.length!==expanded||crc32(decoded)!==crc)invalid();
    total+=expanded;ranges.push([local,localEnd]);
    if(name==='[Content_Types].xml'){if(expanded>1000000)invalid();manifest=utf8(decoded);}
    if(name===mainPart){if(!expanded)invalid();main=true;}
    if(/\.rels$/i.test(name)){const rel=utf8(decoded);if(/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*['"]External['"]/i.test(rel))invalid();}
    i=next;
  }
  ranges.sort((a,b)=>a[0]-b[0]);let cursor=0;
  for(const [a,z] of ranges){if(a!==cursor)invalid();cursor=z;}
  if(cursor!==start||i!==end||!main||!manifest||/<!DOCTYPE|<!ENTITY|macroenabled|vbaproject|activex|oleobject/i.test(manifest))invalid();
  const valid=[...manifest.matchAll(/<(?:[\w-]+:)?Override\b[^>]*>/g)].some(([tag])=>{
    const part=/\bPartName\s*=\s*(['"])(.*?)\1/.exec(tag)?.[2],type=/\bContentType\s*=\s*(['"])(.*?)\1/.exec(tag)?.[2];
    return part==='/'+mainPart&&type===mainType;
  });
  if(!valid)invalid();
}
export function inspectMessagingAttachment({filename,mime,bytes}={}){
  if(typeof filename!=='string'||filename!==filename.trim()||Array.from(filename).length<1||Array.from(filename).length>200||/[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(filename)||typeof mime!=='string'||!Object.hasOwn(extensions,mime)||!extensions[mime].includes(filename.split('.').at(-1).toLowerCase())||!filename.includes('.')||!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>MESSAGING_ATTACHMENT_MAX_BYTES)invalid();
  const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  switch(mime){case 'image/png':png(b);break;case 'image/jpeg':jpeg(b);break;case 'image/webp':webp(b);break;case 'application/pdf':pdf(b);break;case 'text/plain':case 'text/csv':text(b);break;default:validateOffice(b,office[mime]);}
  return Object.freeze({filename,mime,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});
}
export async function readMessagingAttachmentBody(stream,declaredBytes){
  if(!Number.isSafeInteger(declaredBytes)||declaredBytes<1||declaredBytes>MESSAGING_ATTACHMENT_MAX_BYTES||typeof stream?.getReader!=='function')invalid();
  const reader=stream.getReader(),body=new Uint8Array(declaredBytes);let offset=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(!(value instanceof Uint8Array)||offset+value.byteLength>declaredBytes)invalid();body.set(value,offset);offset+=value.byteLength;}if(offset!==declaredBytes)invalid();return body;}
  catch(error){try{await reader.cancel();}catch(_){}throw error;}
  finally{reader.releaseLock();}
}
