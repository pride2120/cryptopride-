const RPC = 'https://rpc.mainnet.chain.robinhood.com';

function validAddress(v){ return /^0x[a-fA-F0-9]{40}$/.test(String(v||'')); }
async function ethCall(to, data){
  const r = await fetch(RPC, {method:'POST', headers:{'content-type':'application/json','user-agent':'CryptoPride-Range-Lab/6.0'}, body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to,data},'latest']})});
  if(!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const j = await r.json();
  if(j.error) throw new Error(j.error.message || 'RPC error');
  return String(j.result||'0x');
}
function uint(hex){ try { return Number(BigInt(hex)); } catch { return 0; } }
function signed24FromWord(hex){
  try { const x=BigInt(hex); const mask=(1n<<24n)-1n; let v=x&mask; if(v&(1n<<23n)) v-=1n<<24n; return Number(v); } catch { return 0; }
}
module.exports = async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const pool=String(req.query?.pool||'').trim();
  if(!validAddress(pool)) return res.status(400).json({error:'Invalid pool address'});
  try{
    const [tickRaw, feeRaw, liqRaw] = await Promise.all([
      ethCall(pool,'0xd0c93a7c').catch(()=>null), // tickSpacing()
      ethCall(pool,'0xddca3f43').catch(()=>null), // fee()
      ethCall(pool,'0x1a686502').catch(()=>null)  // liquidity()
    ]);
    const tickSpacing=tickRaw?signed24FromWord(tickRaw):0;
    const fee=feeRaw?uint(feeRaw):0;
    const activeLiquidity=liqRaw?String(BigInt(liqRaw)):null;
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({pool,tickSpacing,fee,feeRate:fee?fee/1e6:null,activeLiquidity,source:'Robinhood Chain RPC',chainId:4663});
  }catch(e){ return res.status(502).json({error:'Pool state fetch failed',detail:e?.message||String(e)}); }
};
