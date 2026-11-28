import test from 'node:test';
import assert from 'node:assert/strict';
import {crc32} from 'node:zlib';
import * as content from '../security/messaging-attachment-content.mjs';
const bytes=value=>new Uint8Array(Buffer.from(value));
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64'));
const pdf=bytes('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const mimeWord='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const officeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
// Small, uncompressed ZIP fixture. It constructs real local/central records,
// rather than mocking the file parser.
function zip(entries){
  let offset=0;const locals=[],central=[];
  for(const [name,value] of entries){const n=Buffer.from(name),b=Buffer.from(value),local=Buffer.alloc(30),cd=Buffer.alloc(46);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt32LE(crc32(b),14);local.writeUInt32LE(b.length,18);local.writeUInt32LE(b.length,22);local.writeUInt16LE(n.length,26);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x800,8);cd.writeUInt32LE(crc32(b),16);cd.writeUInt32LE(b.length,20);cd.writeUInt32LE(b.length,24);cd.writeUInt16LE(n.length,28);cd.writeUInt32LE(offset,42);locals.push(local,n,b);central.push(cd,n);offset+=local.length+n.length+b.length;}
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return new Uint8Array(Buffer.concat([...locals,directory,end]));
}
const manifest=(type=officeType)=>`<Types><Override PartName="/word/document.xml" ContentType="${type}"/></Types>`;
const doc=(extra=[],type=officeType)=>zip([['[Content_Types].xml',manifest(type)],['word/document.xml','<document/>'],...extra]);
const inspect=(filename,mime,data)=>content.inspectMessagingAttachment({filename,mime,bytes:data});
test('a genuine PNG and PDF produce measured size and sha256 metadata',()=>{
  for(const [filename,mime,data] of [['image.png','image/png',png],['document.pdf','application/pdf',pdf]]){const result=inspect(filename,mime,data);assert.equal(result.filename,filename);assert.equal(result.mime,mime);assert.equal(result.bytes,data.length);assert.match(result.sha256,/^[0-9a-f]{64}$/);}
  assert.notEqual(inspect('image.png','image/png',png).sha256,inspect('document.pdf','application/pdf',pdf).sha256);
});
test('extension, declared format, path and real content must agree',()=>{
  for(const [name,mime,data] of [['image.png','image/png',pdf],['image.pdf','image/png',png],['../file.pdf','application/pdf',pdf],['file.pdf.exe','application/pdf',pdf],['file.pdf','application/pdf',bytes('%PDF-1.7\n')],['image.png','image/png',png.slice(0,-12)],['test.svg','image/svg+xml',bytes('<svg/>')],['x.pdf','application/pdf',new Uint8Array(5000001)]])assert.throws(()=>inspect(name,mime,data),TypeError);
});
test('UTF-8 text and CSV are accepted but disguised binary and control characters are rejected',()=>{
  assert.equal(inspect('report.txt','text/plain',bytes('Report\r\nOK')).bytes,10);
  assert.equal(inspect('table.csv','text/csv',bytes('A,B\n1,2')).bytes,7);
  for(const data of [Uint8Array.from([0,1,2]),Uint8Array.from([0xff,0xff]),bytes('hello\u0000')])assert.throws(()=>inspect('report.txt','text/plain',data),TypeError);
});
test('nonmacro OOXML requires its correct package manifest and main document',()=>{
  const file=doc();assert.equal(inspect('report.docx',mimeWord,file).bytes,file.length);
  for(const data of [zip([['word/document.xml','<document/>']]),doc([], 'application/vnd.ms-word.document.macroEnabled.main+xml'),doc([['word/vbaProject.bin','macro']]),doc([['word/activeX/control.xml','bad']]),doc([['../escape','bad']]),doc([['word/document.xml','duplicate']]),doc().slice(0,-1)])assert.throws(()=>inspect('report.docx',mimeWord,data),TypeError);
});
function stream(parts,onCancel=()=>{}){let i=0;return new ReadableStream({pull(c){if(i===parts.length)c.close();else c.enqueue(parts[i++]);},cancel(){onCancel();}});}
test('stream reader enforces measured bytes and rejects false size declarations',async()=>{
  assert.deepEqual(await content.readMessagingAttachmentBody(stream([Uint8Array.of(1),Uint8Array.of(2,3)]),3),Uint8Array.of(1,2,3));
  let cancelled=false;await assert.rejects(content.readMessagingAttachmentBody(stream([Uint8Array.of(1,2,3),Uint8Array.of(4)],()=>{cancelled=true;}),2),TypeError);assert.equal(cancelled,true);
  await assert.rejects(content.readMessagingAttachmentBody(stream([Uint8Array.of(1)]),2),TypeError);
  await assert.rejects(content.readMessagingAttachmentBody(stream([]),5000001),TypeError);
});
