// Exercise native DOM selection, including Origin's open ShadowRoot.
export async function selectNoteText(editor,start,end=start){
 await editor.focus();
 await editor.evaluate((surface,[a,b])=>{
  const doc=surface.ownerDocument;
  const point=offset=>{
   const walker=doc.createTreeWalker(surface,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode())){if(offset<=node.length)return [node,offset];offset-=node.length;}
   return [surface,surface.childNodes.length];
  };
  const selection=surface.getRootNode().getSelection?.()||doc.getSelection();
  selection.setBaseAndExtent(...point(a),...point(b));
 },[start,end]);
}
