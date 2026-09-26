import {timingSafeEqual} from 'node:crypto';
import {getSnapshot} from '../lib/architect.js';
const equal=(a,b)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const configured=!!(process.env.ARCHITECT_API_KEY&&process.env.ARCHITECT_API_SECRET);
  if(configured){
    const token=process.env.DATA_ACCESS_TOKEN;
    if(!token)return res.status(503).json({mode:'locked',message:'Server must set DATA_ACCESS_TOKEN before serving authenticated data.'});
    if(!equal(req.headers.authorization||'','Bearer '+token))return res.status(401).json({mode:'locked',message:'Enter the demo access token. Exchange credentials stay on the server.'});
  }
  try{return res.status(200).json(await getSnapshot());}
  catch{return res.status(502).json({mode:'unavailable',message:'Architect data could not be validated. Check server credentials, permissions, market hours and book freshness. No synthetic fallback was substituted.'});}
}
