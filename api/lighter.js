import {getLighter} from '../lib/lighter.js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 try{const snapshot=await getLighter();res.setHeader('Cache-Control','public, s-maxage=30, max-age=0');return res.status(200).json(snapshot);}
 catch{res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'Lighter H100 data unavailable or invalid. No synthetic fallback.'});}
}
