// Keep command and observation ledgers readable as one JSON record per line.
export function evidenceJson(value) {
  const blocks=[];
  let text=JSON.stringify(value,(key,item)=>{
    if (['ledger','commands','a','b','c'].includes(key)&&Array.isArray(item)) {
      const marker='__FUZZ_EVIDENCE_BLOCK_'+blocks.length+'__';
      blocks.push({marker,text:'[\n'+item.map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ]'});
      return marker;
    }
    return item;
  },2);
  for(const block of blocks)text=text.replace(JSON.stringify(block.marker),()=>block.text);
  return text+'\n';
}
